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
        innerHTML: `<svg class="chat-widget-button-icon" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v3c0 .6.4 1 1 1 .2 0 .5-.1.7-.3L14.6 18H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>`
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
    
      const closeBtn = this.createElement('button', { 
        className: 'chat-widget-close-btn', 
        innerHTML: '×', 
        ariaLabel: 'Close Chat' 
      });
    
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
    
      const input = this.createElement('input', { 
        type: 'text', 
        placeholder: 'Type a message...' 
      });
    
      const sendButton = this.createElement('button', { 
        ariaLabel: 'Send Message', 
        innerHTML: `<svg class="chat-widget-send-icon" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>` 
      });
    
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
        console.log('Sending message to API:', text);
    
        const response = await fetch(this.config.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, user: { sessionId: this.state.sessionId } })
        });
    
        if (!response.ok) { 
          throw new Error(`HTTP error! status: ${response.status}`); 
        }
    
        const data = await response.json();
        console.log('Received response from API:', data);
    
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
      console.log('Extracting reply from data:', data);

      if (Array.isArray(data) && data.length > 0) {
        if (data[0].content !== undefined) {
          console.log('Found array format with content property');
          return data; // return array directly
        }
        return data[0].content || data[0].message || data[0].text || "Sorry, I couldn't understand the response.";
      }

      if (typeof data === 'object' && data !== null) {
        return data;
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
      const messagesContainer = this.elements.panel.querySelector('.chat-widget-messages');
      this.addMessageToUI(sender, text, messagesContainer);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
      if (sender !== 'indicator') {
        this.state.history.push({ sender, text });
        this.saveState();
      }
    }

    addMessageToUI(sender, text, container) {
      console.log('addMessageToUI called with:', sender, typeof text, text);

      if (sender === 'assistant') {
        if (Array.isArray(text)) {
          text.forEach(item => {
            if (item.content) {
              const textEl = this.createMessageElement(sender, item.content);
              container.appendChild(textEl);
            }
            if (item.type === 'product_list' && Array.isArray(item.products) && item.products.length > 0) {
              const carouselEl = this.createCarouselElement(item.products);
              container.appendChild(carouselEl);
            }
          });
          return;
        }

        if (typeof text === 'object' && text.content) {
          const textEl = this.createMessageElement(sender, text.content);
          container.appendChild(textEl);
          if (text.type === 'product_list' && Array.isArray(text.products)) {
            const carouselEl = this.createCarouselElement(text.products);
            container.appendChild(carouselEl);
          }
          return;
        }

        const msgEl = this.createMessageElement(sender, String(text));
        container.appendChild(msgEl);

      } else {
        const msgEl = this.createMessageElement(sender, text);
        container.appendChild(msgEl);
      }
    }

    createMessageElement(sender, text) {
      const msgDiv = this.createElement('div', { className: `chat-widget-message ${sender}` });
      const p = this.createElement('p', { textContent: text });
      msgDiv.appendChild(p);
      return msgDiv;
    }

    createCarouselElement(products) {
        console.log('Creating carousel element with products:', products);

        const container = this.createElement('div', { className: 'product-carousel-container' });
        const carousel = this.createElement('div', { className: 'product-carousel' });
        
        const productCount = products.length;
        if (productCount === 0) return container;

        // Triple the products for seamless looping
        const allProducts = [...products, ...products, ...products];

        allProducts.forEach((product) => {
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
            img.onerror = function() {
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIj5JbWFnZTwvdGV4dD48L3N2Zz4=';
            };

            const title = this.createElement('h4', {
                className: 'product-title',
                textContent: product.title
            });

            cardLink.appendChild(img);
            cardLink.appendChild(title);

            const priceContainer = this.createElement('div', { className: 'product-price-container' });
            const isDiscounted = product.originalPrice && parseFloat(product.originalPrice) > parseFloat(product.currentPrice);

            if (product.currentPrice) {
                const currentPriceEl = this.createElement('p', {
                    className: 'product-price',
                    textContent: `${product.currentPrice} ${product.currency}`
                });
                priceContainer.appendChild(currentPriceEl);
            }

            if (isDiscounted) {
                const originalPriceEl = this.createElement('p', {
                    className: 'original-price',
                    textContent: `${product.originalPrice} ${product.currency}`
                });
                priceContainer.appendChild(originalPriceEl);
            }
            cardLink.appendChild(priceContainer);

            carousel.appendChild(cardLink);
        });

        container.appendChild(carousel);

        carousel.dataset.currentIndex = productCount; // Start at the beginning of the second set
        carousel.dataset.productCount = productCount;
        carousel.dataset.isTransitioning = 'false';

        if (products.length > 1) {
            const prevButton = this.createElement('button', {
                className: 'carousel-arrow prev',
                innerHTML: '❮',
                ariaLabel: 'Previous product'
            });
            const nextButton = this.createElement('button', {
                className: 'carousel-arrow next',
                innerHTML: '❯',
                ariaLabel: 'Next product'
            });
            container.appendChild(prevButton);
            container.appendChild(nextButton);
            prevButton.addEventListener('click', () => this.navigateCarousel(carousel, -1));
            nextButton.addEventListener('click', () => this.navigateCarousel(carousel, 1));
        }

        setTimeout(() => {
            this.setupCarousel(carousel);
        }, 0);

        return container;
    }

    setupCarousel(carousel) {
        const cardWidth = 140; // from CSS
        const totalCardWidth = cardWidth * 0.7; // Adjusted for overlap
        const initialIndex = parseInt(carousel.dataset.currentIndex, 10);
        
        const containerWidth = carousel.parentElement.offsetWidth;
        const centerOffset = (containerWidth / 2) - (cardWidth / 2);
        const initialX = centerOffset - (initialIndex * totalCardWidth);
        
        carousel.style.transition = 'none';
        carousel.style.transform = `translateX(${initialX}px)`;
        this.updateCoverflowEffect(carousel, initialIndex);

        setTimeout(() => {
            carousel.style.transition = 'transform 0.4s ease';
        }, 50);
    }

    navigateCarousel(carousel, direction) {
        if (carousel.dataset.isTransitioning === 'true') return;
        carousel.dataset.isTransitioning = 'true';

        let currentIndex = parseInt(carousel.dataset.currentIndex, 10);
        const productCount = parseInt(carousel.dataset.productCount, 10);
        const cardWidth = 140;
        const totalCardWidth = cardWidth * 0.7; // Adjusted for overlap

        currentIndex += direction;
        carousel.dataset.currentIndex = currentIndex;
        
        carousel.style.transition = 'transform 0.4s ease';
        const containerWidth = carousel.parentElement.offsetWidth;
        const centerOffset = (containerWidth / 2) - (cardWidth / 2);
        const newX = centerOffset - (currentIndex * totalCardWidth);
        carousel.style.transform = `translateX(${newX}px)`;

        this.updateCoverflowEffect(carousel, currentIndex);
        
        const handleTransitionEnd = () => {
            carousel.removeEventListener('transitionend', handleTransitionEnd);
            let needsReset = false;
            if (currentIndex <= productCount - 1) {
                currentIndex += productCount;
                needsReset = true;
            } else if (currentIndex >= productCount * 2) {
                currentIndex -= productCount;
                needsReset = true;
            }

            if (needsReset) {
                carousel.style.transition = 'none';
                carousel.dataset.currentIndex = currentIndex;
                const resetX = centerOffset - (currentIndex * totalCardWidth);
                carousel.style.transform = `translateX(${resetX}px)`;
                this.updateCoverflowEffect(carousel, currentIndex);
                
                setTimeout(() => {
                    carousel.style.transition = 'transform 0.4s ease';
                }, 20);
            }
            carousel.dataset.isTransitioning = 'false';
        };

        carousel.addEventListener('transitionend', handleTransitionEnd);
    }

    updateCoverflowEffect(carousel, centerIndex) {
        const cards = carousel.querySelectorAll('.product-card');
        cards.forEach((card, index) => {
            const distance = index - centerIndex;
            const absDistance = Math.abs(distance);
            const side = Math.sign(distance);

            let transform = '';
            let opacity = '0';
            let zIndex = '0';

            if (absDistance <= 1) { // Show center and immediate neighbors
                opacity = '1';
                zIndex = `${20 - absDistance}`;
                
                const scale = distance === 0 ? 1.05 : 0.9;
                const rotateY = distance === 0 ? 0 : -50 * side;
                const translateX = distance === 0 ? 0 : 60 * side;
                const translateZ = distance === 0 ? 50 : -20;
                
                transform = `translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`;
            } else {
                 // Hide cards that are further away
                 opacity = '0';
                 transform = `scale(0.8)`;
            }

            card.style.transform = transform;
            card.style.opacity = opacity;
            card.style.zIndex = zIndex;
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

