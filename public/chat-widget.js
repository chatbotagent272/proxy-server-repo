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
            // Handle the new format where data is an array of message objects
            if (Array.isArray(data) && data.length > 0) {
                // If the first item has a content property, return the entire array as a JSON string
                if (data[0].content !== undefined) {
                    return JSON.stringify(data);
                }
                // Otherwise, try to extract content from the first item
                return data[0].content || data[0].message || data[0].text || "Sorry, I couldn't understand the response.";
            }
            // Handle the old format where data is a single object
            if (typeof data === 'object' && data !== null) { 
                return data.content || data.message || data.text || "Sorry, I couldn't understand the response."; 
            }
            // Handle the case where data is a string
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
        // Modified to handle the new JSON format
        addMessageToUI(sender, text, container) {
            if (sender === 'assistant') {
                // Try to parse the text as JSON to handle the new format
                try {
                    const data = JSON.parse(text);
                    if (Array.isArray(data) && data.length > 0 && data[0].content !== undefined) {
                        // Handle the new format
                        data.forEach(item => {
                            if (item.content) {
                                // Add the text content
                                const textEl = this.createMessageElement(sender, item.content);
                                container.appendChild(textEl);
                                
                                // If it's a product_list type and has products, create a carousel
                                if (item.type === 'product_list' && item.products && Array.isArray(item.products) && item.products.length > 0) {
                                    const carouselEl = this.createCarouselElement(item.products);
                                    container.appendChild(carouselEl);
                                }
                            }
                        });
                    } else {
                        // Fall back to the old format
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
                    }
                } catch (error) {
                    // If JSON parsing fails, fall back to the old format
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
                }
            } else {
                // For user messages
                const msgEl = this.createMessageElement(sender, text);
                container.appendChild(msgEl);
            }
        }
        
        // Parse PRODUCTS_JSON from text (old format)
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
            
            // For a good coverflow effect, we need at least 3 items. Duplicate if necessary.
            let displayProducts = [...products];
            while (displayProducts.length > 0 && displayProducts.length < 3) {
                displayProducts = [...displayProducts, ...products];
            }
            const productCount = displayProducts.length;
            if (productCount === 0) return container;
        
            // Create three sets of products for a seamless infinite loop
            const allProducts = [...displayProducts, ...displayProducts, ...displayProducts];
            
            allProducts.forEach(product => {
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
                
                const title = this.createElement('h4', { 
                    className: 'product-title',
                    textContent: product.title 
                });
                
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
            
            // Attach state variables to the DOM element
            carousel.dataset.currentIndex = productCount;
            carousel.dataset.productCount = productCount;
            carousel.dataset.isTransitioning = 'false';
            
            // Initialize carousel position after elements are rendered
            setTimeout(() => {
                this.setupCarousel(carousel);
            }, 100);
            
            // Add navigation arrows if there's more than one unique product
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
                
                prevButton.addEventListener('click', () => this.navigateCarousel(carousel, -1));
                nextButton.addEventListener('click', () => this.navigateCarousel(carousel, 1));
            }
            return container;
        }
        
        setupCarousel(carousel) {
            const cardWidth = 180; // Must match CSS
            const gap = 20; // Must match CSS
            const totalCardWidth = cardWidth + gap;
            const initialIndex = parseInt(carousel.dataset.currentIndex, 10);
        
            // Set carousel width
            carousel.style.width = `${carousel.children.length * totalCardWidth}px`;
            
            // Position the carousel to show the first item of the middle block
            const containerWidth = carousel.parentElement.offsetWidth;
            const centerOffset = (containerWidth - cardWidth) / 2;
            const initialX = centerOffset - (initialIndex * totalCardWidth);
            carousel.style.transform = `translateX(${initialX}px)`;
            
            // Apply initial coverflow effect
            this.updateCoverflowEffect(carousel, initialIndex);
        }
        
        navigateCarousel(carousel, direction) {
            if (carousel.dataset.isTransitioning === 'true') return;
            carousel.dataset.isTransitioning = 'true';
        
            let currentIndex = parseInt(carousel.dataset.currentIndex, 10);
            const productCount = parseInt(carousel.dataset.productCount, 10);
            const cardWidth = 180;
            const gap = 20;
            const totalCardWidth = cardWidth + gap;
        
            currentIndex += direction;
            carousel.dataset.currentIndex = currentIndex;
        
            // Move carousel with transition
            carousel.style.transition = 'transform 0.4s ease';
            const containerWidth = carousel.parentElement.offsetWidth;
            const centerOffset = (containerWidth - cardWidth) / 2;
            const newX = centerOffset - (currentIndex * totalCardWidth);
            carousel.style.transform = `translateX(${newX}px)`;
        
            this.updateCoverflowEffect(carousel, currentIndex);
        
            // Use transitionend to handle the infinite scroll "jump"
            carousel.addEventListener('transitionend', () => {
                let needsReset = false;
                if (currentIndex >= productCount * 2) { // Reached end of middle block
                    currentIndex -= productCount;
                    needsReset = true;
                } else if (currentIndex < productCount) { // Reached start of middle block
                    currentIndex += productCount;
                    needsReset = true;
                }
        
                if (needsReset) {
                    carousel.style.transition = 'none';
                    const resetX = centerOffset - (currentIndex * totalCardWidth);
                    carousel.style.transform = `translateX(${resetX}px)`;
                    carousel.dataset.currentIndex = currentIndex;
                }
        
                carousel.dataset.isTransitioning = 'false';
            }, { once: true }); // Listener fires only once per navigation
        }
        
        updateCoverflowEffect(carousel, centerIndex) {
            const cards = carousel.querySelectorAll('.product-card');
            cards.forEach((card, index) => {
                const distance = index - centerIndex;
                const absDistance = Math.abs(distance);
        
                if (distance === 0) {
                    // Center card
                    card.style.transform = 'translateZ(0px) scale(1)';
                    card.style.opacity = '1';
                    card.style.zIndex = '10';
                } else {
                    // Side cards
                    const side = Math.sign(distance);
                    card.style.transform = `translateX(${side * 55 * absDistance}px) translateZ(-${80 * absDistance}px) rotateY(${side * 30}deg) scale(${1 - (absDistance * 0.15)})`;
                    card.style.opacity = `${Math.max(0.4, 1 - absDistance * 0.3)}`;
                    card.style.zIndex = `${10 - absDistance}`;
                }
                card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
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
