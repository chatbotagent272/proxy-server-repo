(function(window) {
    'use strict';

    const SESSION_STATE_KEY = 'chat_widget_session_state';

    class ChatWidget {
        constructor(config) {
            this.config = Object.assign({
                primaryColor: '#5B8DEF',
                companyName: 'Support',
                logoUrl: '',
                welcomeMessage: 'Hello! How can we help?',
                apiUrl: 'https://proxy-server-repo.vercel.app/api/chat',
                container: 'body'
            }, config);
            
            this.elements = {};
            // Pass config to loadState to ensure welcome message is available
            this.state = this.loadState(this.config); 
            this.isThinking = false;
        }

        init() {
            if (document.querySelector('.chat-widget-button')) {
                console.warn("Chat Widget is already initialized.");
                return this;
            }
            this.createElements();
            this.attachEventListeners();
            
            const containerEl = document.querySelector(this.config.container);
            if (containerEl) {
                containerEl.appendChild(this.elements.button);
                containerEl.appendChild(this.elements.panel);
            } else {
                console.error(`Chat Widget container "${this.config.container}" not found.`);
                return this;
            }
            
            this.applyTheme();
            this.restoreUIState();
            this.injectStyles();
            return this;
        }

        createElements() {
            this.elements.button = this.createElement('button', {
                className: 'chat-widget-button',
                ariaLabel: 'Toggle Chat Window',
                innerHTML: `<svg class="chat-widget-button-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path></svg>`
            });

            this.elements.panel = this.createElement('div', { className: 'chat-widget-panel' });
            
            const header = this.createHeader();
            const messagesContainer = this.createMessagesContainer();
            const inputArea = this.createInputArea();

            this.elements.panel.appendChild(header);
            this.elements.panel.appendChild(messagesContainer);
            this.elements.panel.appendChild(inputArea);
        }
        
        createHeader() {
            const header = this.createElement('div', { className: 'chat-widget-header' });
            const avatarDiv = this.createElement('div', { className: 'chat-widget-header-avatar' });
            if (this.config.logoUrl) {
                const avatarImg = this.createElement('img', { src: this.config.logoUrl, alt: 'Logo' });
                avatarDiv.appendChild(avatarImg);
            }
            const titleDiv = this.createElement('div', { className: 'chat-widget-header-title' });
            const companyName = this.createElement('h3', { textContent: this.config.companyName });
            const status = this.createElement('span', { textContent: 'Online' });
            titleDiv.appendChild(companyName);
            titleDiv.appendChild(status);
            const closeBtn = this.createElement('button', { className: 'chat-widget-close-btn', innerHTML: '&times;', ariaLabel: 'Close Chat' });
            header.appendChild(avatarDiv);
            header.appendChild(titleDiv);
            header.appendChild(closeBtn);
            return header;
        }

        createMessagesContainer() {
            const messagesContainer = this.createElement('div', { className: 'chat-widget-messages' });
            this.state.history.forEach(msg => {
                this.addMessageToUI(msg.sender, msg.text, messagesContainer);
            });
            return messagesContainer;
        }
        
        createInputArea() {
            const inputArea = this.createElement('div', { className: 'chat-widget-input-area' });
            const input = this.createElement('input', { type: 'text', placeholder: 'Type a message...' });
            const sendButton = this.createElement('button', { ariaLabel: 'Send Message', innerHTML: `<svg class="chat-widget-send-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>` });
            inputArea.appendChild(input);
            inputArea.appendChild(sendButton);
            return inputArea;
        }

        createElement(tag, props) {
            const el = document.createElement(tag);
            Object.keys(props).forEach(key => el[key] = props[key]);
            return el;
        }

        attachEventListeners() {
            this.elements.button.addEventListener('click', () => this.toggle());
            this.elements.panel.querySelector('.chat-widget-close-btn').addEventListener('click', () => this.close());
            
            const input = this.elements.panel.querySelector('input');
            const sendButton = this.elements.panel.querySelector('.chat-widget-input-area button');

            sendButton.addEventListener('click', () => this.handleSendMessage());
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.handleSendMessage();
            });
        }

        handleSendMessage() {
            const input = this.elements.panel.querySelector('input');
            const text = input.value;
            if (!text.trim() || this.isThinking) return;

            this.addMessage('user', text);
            input.value = '';
            
            this.sendToWebhook(text);
        }
        
        async sendToWebhook(text) {
            if (!this.config.apiUrl) {
                console.error("Chat Widget: apiUrl is not configured.");
                this.addMessage('assistant', "Error: Chat service is not configured correctly.");
                return;
            }
            this.isThinking = true;
            this.showTypingIndicator();
            try {
                const response = await fetch(this.config.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text, user: { sessionId: this.state.sessionId } })
                });
                if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
                const data = await response.json();
                const reply = this.extractReply(data);
                this.addMessage('assistant', reply);
            } catch (error) {
                console.error("Error calling API:", error);
                this.addMessage('assistant', "Sorry, something went wrong. Please try again.");
            } finally {
                this.isThinking = false;
                this.hideTypingIndicator();
            }
        }

        extractReply(data) {
            if (Array.isArray(data) && data[0]) { 
                const item = data[0]; 
                return item.content || item.message || item.text || "Sorry, I couldn't understand the response."; 
            }
            if (typeof data === 'object' && data !== null) { 
                return data.content || data.message || data.text || "Sorry, I couldn't understand the response."; 
            }
            if (typeof data === 'string') { 
                return data; 
            }
            return "Sorry, I received an unhandled response format.";
        }
        
        toggle() {
            this.state.isOpen ? this.close() : this.open();
        }

        open() {
            this.elements.panel.classList.add('open');
            this.elements.button.classList.add('open');
            this.state.isOpen = true;
            this.saveState();
        }

        close() {
            this.elements.panel.classList.remove('open');
            this.elements.button.classList.remove('open');
            this.state.isOpen = false;
            this.saveState();
        }
        
        addMessage(sender, text) {
            // Add to UI
            const messagesContainer = this.elements.panel.querySelector('.chat-widget-messages');
            this.addMessageToUI(sender, text, messagesContainer);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Add to state and save if it's not a temporary indicator
            if (sender !== 'indicator') {
                this.state.history.push({ sender, text });
                this.saveState();
            }
        }

        // Modified to handle PRODUCTS_JSON format
        addMessageToUI(sender, text, container) {
            if (sender === 'assistant') {
                const products = this.parseProductsFromText(text);
                
                if (products.length > 0) {
                    // Extract text that is NOT part of the PRODUCTS_JSON
                    const mainText = text.replace(/PRODUCTS_JSON:\s*\[.*?\]/s, '').trim();

                    if (mainText) {
                        const textEl = this.createMessageElement(sender, mainText);
                        container.appendChild(textEl);
                    }

                    const carouselEl = this.createCarouselElement(products);
                    container.appendChild(carouselEl);
                } else {
                    // No products found, display as plain text
                    const msgEl = this.createMessageElement(sender, text);
                    container.appendChild(msgEl);
                }
            } else {
                // For user messages
                const msgEl = this.createMessageElement(sender, text);
                container.appendChild(msgEl);
            }
        }
        
        // Parse PRODUCTS_JSON from text
        parseProductsFromText(text) {
            const products = [];
            const match = text.match(/PRODUCTS_JSON:\s*(\[.*?\])/s);
            
            if (match) {
                try {
                    const productsData = JSON.parse(match[1]);
                    return productsData.map(product => ({
                        title: product.title || 'Product',
                        price: product.price || '',
                        currency: product.currency || '',
                        url: product.url || '#',
                        image_url: product.image_url || ''
                    }));
                } catch (error) {
                    console.error('Error parsing PRODUCTS_JSON:', error);
                }
            }
            
            return products;
        }

        createMessageElement(sender, text) {
            const msgDiv = this.createElement('div', { className: `chat-widget-message ${sender}` });
            const p = this.createElement('p', { textContent: text });
            msgDiv.appendChild(p);
            return msgDiv;
        }
        
        createCarouselElement(products) {
            const container = this.createElement('div', { className: 'product-carousel-container' });
            const carousel = this.createElement('div', { className: 'product-carousel' });
            
            // Create duplicate products for infinite scroll effect
            const allProducts = [...products, ...products, ...products];
            
            allProducts.forEach((product, index) => {
                const cardLink = this.createElement('a', { 
                    href: product.url,
                    className: 'product-card',
                    target: '_blank',
                    rel: 'noopener noreferrer'
                });
                
                const img = this.createElement('img', { 
                    src: product.image_url, 
                    alt: product.title,
                    loading: 'lazy'
                });
                const title = this.createElement('h4', { textContent: product.title });
                
                cardLink.appendChild(img);
                cardLink.appendChild(title);
                
                if (product.price) {
                    const price = this.createElement('p', { 
                        className: 'product-price',
                        textContent: `${product.price} ${product.currency}` 
                    });
                    cardLink.appendChild(price);
                }

                carousel.appendChild(cardLink);
            });

            container.appendChild(carousel);

            // Initialize carousel position to show center item
            setTimeout(() => {
                const cardWidth = 200; // card width + gap
                const centerIndex = products.length; // Start at the first duplicate set
                carousel.scrollLeft = centerIndex * cardWidth;
                this.updateCarouselOpacity(carousel);
            }, 100);

            // Add scroll event listener for opacity updates
            carousel.addEventListener('scroll', () => {
                this.updateCarouselOpacity(carousel);
            });

            // Add navigation arrows
            if (products.length > 1) {
                const prevButton = this.createElement('button', { 
                    className: 'carousel-arrow prev', 
                    innerHTML: '&#10094;',
                    ariaLabel: 'Previous product'
                });
                const nextButton = this.createElement('button', { 
                    className: 'carousel-arrow next', 
                    innerHTML: '&#10095;',
                    ariaLabel: 'Next product'
                });
                
                container.appendChild(prevButton);
                container.appendChild(nextButton);

                const cardWidth = 200;
                const originalLength = products.length;

                prevButton.addEventListener('click', () => {
                    const currentScroll = carousel.scrollLeft;
                    const newScroll = currentScroll - cardWidth;
                    
                    carousel.scrollTo({
                        left: newScroll,
                        behavior: 'smooth'
                    });
                    
                    // Handle infinite scroll
                    setTimeout(() => {
                        if (carousel.scrollLeft <= 0) {
                            carousel.scrollLeft = originalLength * cardWidth;
                        }
                    }, 300);
                });

                nextButton.addEventListener('click', () => {
                    const currentScroll = carousel.scrollLeft;
                    const newScroll = currentScroll + cardWidth;
                    
                    carousel.scrollTo({
                        left: newScroll,
                        behavior: 'smooth'
                    });
                    
                    // Handle infinite scroll
                    setTimeout(() => {
                        const maxScroll = (originalLength * 2) * cardWidth;
                        if (carousel.scrollLeft >= maxScroll) {
                            carousel.scrollLeft = originalLength * cardWidth;
                        }
                    }, 300);
                });
            }

            return container;
        }

        updateCarouselOpacity(carousel) {
            const cards = carousel.querySelectorAll('.product-card');
            const containerRect = carousel.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;

            cards.forEach(card => {
                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const distance = Math.abs(containerCenter - cardCenter);
                
                // Calculate opacity based on distance from center
                const maxDistance = containerRect.width / 2;
                const opacity = Math.max(0.3, 1 - (distance / maxDistance));
                
                card.style.opacity = opacity;
                
                // Add scale effect for center item
                const scale = distance < 50 ? 1.05 : 1;
                card.style.transform = `scale(${scale})`;
            });
        }

        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { 
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); 
                return v.toString(16); 
            });
        }

        showTypingIndicator() {
            const messagesContainer = this.elements.panel.querySelector('.chat-widget-messages');
            const typingIndicator = this.createElement('div', { 
                className: 'chat-widget-message assistant typing-indicator', 
                innerHTML: '<span></span><span></span><span></span>' 
            });
            messagesContainer.appendChild(typingIndicator);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        hideTypingIndicator() {
            const typingIndicator = this.elements.panel.querySelector('.typing-indicator');
            if (typingIndicator) { 
                typingIndicator.remove(); 
            }
        }
        
        applyTheme() {
            document.documentElement.style.setProperty('--chat-widget-primary-color', this.config.primaryColor);
        }

        injectStyles() {
            if (document.getElementById('chat-widget-carousel-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'chat-widget-carousel-styles';
            style.textContent = `
                .product-carousel-container {
                    position: relative;
                    margin: 15px 0;
                    padding: 0 30px;
                }

                .product-carousel {
                    display: flex;
                    gap: 20px;
                    overflow-x: auto;
                    scroll-behavior: smooth;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    padding: 10px 0;
                }

                .product-carousel::-webkit-scrollbar {
                    display: none;
                }

                .product-card {
                    flex: 0 0 180px;
                    background: #fff;
                    border-radius: 12px;
                    padding: 15px;
                    text-decoration: none;
                    color: inherit;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: all 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }

                .product-card:hover {
                    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
                    transform: translateY(-2px) !important;
                }

                .product-card img {
                    width: 100%;
                    height: 120px;
                    object-fit: cover;
                    border-radius: 8px;
                    margin-bottom: 10px;
                }

                .product-card h4 {
                    font-size: 14px;
                    font-weight: 600;
                    margin: 0 0 8px 0;
                    line-height: 1.3;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .product-card .product-price {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--chat-widget-primary-color, #5B8DEF);
                    margin: 0;
                }

                .carousel-arrow {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(255,255,255,0.9);
                    border: 1px solid #ddd;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 18px;
                    color: #333;
                    z-index: 10;
                    transition: all 0.2s ease;
                }

                .carousel-arrow:hover {
                    background: #fff;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }

                .carousel-arrow.prev {
                    left: 0;
                }

                .carousel-arrow.next {
                    right: 0;
                }

                @media (max-width: 480px) {
                    .product-carousel-container {
                        padding: 0 25px;
                    }
                    
                    .product-card {
                        flex: 0 0 160px;
                    }
                    
                    .carousel-arrow {
                        width: 35px;
                        height: 35px;
                        font-size: 16px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        saveState() {
            sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(this.state));
        }

        loadState(config) {
            const savedState = sessionStorage.getItem(SESSION_STATE_KEY);
            if (savedState) {
                return JSON.parse(savedState);
            }
            return {
                sessionId: this.generateUUID(),
                isOpen: false,
                history: [{ sender: 'assistant', text: config.welcomeMessage }]
            };
        }
        
        restoreUIState() {
            if (this.state.isOpen) {
                this.elements.panel.classList.add('open');
                this.elements.button.classList.add('open');
            }
            const messagesContainer = this.elements.panel.querySelector('.chat-widget-messages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        destroy() {
            if (this.elements.button) this.elements.button.remove();
            if (this.elements.panel) this.elements.panel.remove();
            const styles = document.getElementById('chat-widget-carousel-styles');
            if (styles) styles.remove();
        }
    }

    window.ChatWidget = {
        init: (config) => {
            if (window.chatWidgetInstance) {
                window.chatWidgetInstance.destroy();
                window.chatWidgetInstance = null;
            }
            window.chatWidgetInstance = new ChatWidget(config);
            return window.chatWidgetInstance.init();
        }
    };

})(window);

