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
                    rel: 'noopener noreferrer',
                    'data-index': index % products.length // Store original index
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
                
                // Add elements in correct order: image, title, price
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
                this.setupCoverflow(carousel, products.length);
            }, 100);
            
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
                
                const originalLength = products.length;
                
                prevButton.addEventListener('click', () => {
                    this.navigateCarousel(carousel, -1, originalLength);
                });
                
                nextButton.addEventListener('click', () => {
                    this.navigateCarousel(carousel, 1, originalLength);
                });
            }
            return container;
        }
        
        setupCoverflow(carousel, productCount) {
            const cards = carousel.querySelectorAll('.product-card');
            const cardWidth = 180; // Match CSS width
            const gap = 20; // Match CSS gap
            const totalCardWidth = cardWidth + gap;
            
            // Set carousel width to accommodate all cards
            carousel.style.width = `${cards.length * totalCardWidth}px`;
            
            // Position the first product in the center
            const containerWidth = carousel.parentElement.offsetWidth;
            const centerOffset = (containerWidth - cardWidth) / 2;
            carousel.style.transform = `translateX(${centerOffset}px)`;
            
            // Apply initial coverflow styling
            this.updateCoverflowEffect(carousel, 0);
        }
        
        navigateCarousel(carousel, direction, productCount) {
            const cards = carousel.querySelectorAll('.product-card');
            if (cards.length === 0) return;
            
            // Get current position
            const transform = window.getComputedStyle(carousel).transform;
            const matrix = new DOMMatrix(transform);
            const currentX = matrix.m41; // Extract X translation
            
            const cardWidth = 180; // Match CSS width
            const gap = 20; // Match CSS gap
            const totalCardWidth = cardWidth + gap;
            
            // Calculate new position
            const newX = currentX - (direction * totalCardWidth);
            
            // Apply new position with transition
            carousel.style.transition = 'transform 0.3s ease';
            carousel.style.transform = `translateX(${newX}px)`;
            
            // Update coverflow effect
            const currentIndex = Math.round((currentX - (carousel.parentElement.offsetWidth - cardWidth) / 2) / -totalCardWidth);
            this.updateCoverflowEffect(carousel, currentIndex + direction);
            
            // Handle infinite scroll
            setTimeout(() => {
                // Check if we need to reset position for infinite effect
                const currentTransform = window.getComputedStyle(carousel).transform;
                const currentMatrix = new DOMMatrix(currentTransform);
                const currentPosX = currentMatrix.m41;
                
                // If we've moved too far in either direction, reset position
                const maxOffset = productCount * totalCardWidth;
                if (Math.abs(currentPosX) > maxOffset) {
                    carousel.style.transition = 'none';
                    carousel.style.transform = `translateX(${currentPosX > 0 ? currentPosX - maxOffset : currentPosX + maxOffset}px)`;
                    
                    // Restore transition after reset
                    setTimeout(() => {
                        carousel.style.transition = 'transform 0.3s ease';
                    }, 50);
                }
            }, 350);
        }
        
        updateCoverflowEffect(carousel, centerIndex) {
            const cards = carousel.querySelectorAll('.product-card');
            const containerWidth = carousel.parentElement.offsetWidth;
            const centerOffset = (containerWidth - 180) / 2; // 180 is card width from CSS
            
            cards.forEach((card, index) => {
                // Calculate distance from center
                const distance = Math.abs(index - centerIndex);
                
                // Reset all transforms first
                card.style.transform = '';
                card.style.opacity = '';
                card.style.zIndex = '';
                
                if (distance === 0) {
                    // Center card
                    card.style.transform = 'translateZ(0) scale(1)';
                    card.style.opacity = '1';
                    card.style.zIndex = '10';
                } else if (distance === 1) {
                    // Adjacent cards
                    const side = index < centerIndex ? -1 : 1;
                    card.style.transform = `translateX(${side * 70}px) translateZ(-100px) scale(0.85) rotateY(${side * 25}deg)`;
                    card.style.opacity = '0.8';
                    card.style.zIndex = '8';
                } else if (distance === 2) {
                    // Further cards
                    const side = index < centerIndex ? -1 : 1;
                    card.style.transform = `translateX(${side * 120}px) translateZ(-200px) scale(0.7) rotateY(${side * 35}deg)`;
                    card.style.opacity = '0.5';
                    card.style.zIndex = '6';
                } else {
                    // Far cards - mostly hidden
                    const side = index < centerIndex ? -1 : 1;
                    card.style.transform = `translateX(${side * 150}px) translateZ(-300px) scale(0.6) rotateY(${side * 40}deg)`;
                    card.style.opacity = '0.3';
                    card.style.zIndex = '4';
                }
                
                // Add transition for smooth changes
                card.style.transition = 'transform 0.3s ease, opacity 0.3s ease, z-index 0.3s ease';
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
