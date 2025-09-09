(function(window) {
    'use strict';

    class ChatWidget {
        constructor(config) {
            this.config = Object.assign({
                primaryColor: '#5B8DEF',
                companyName: 'Support',
                logoUrl: '',
                welcomeMessage: 'Hello! How can we help?',
                webhookUrl: 'https://proxy-server-repo.vercel.app/api/chat',
                container: 'body'
            }, config);
            
            this.elements = {};
            this.isOpen = false;
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
            return this;
        }

        createElements() {
            this.elements.button = this.createElement('button', {
                className: 'chat-widget-button',
                innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path></svg>`
            });

            this.elements.panel = this.createElement('div', {
                className: 'chat-widget-panel',
                innerHTML: `
                    <div class="chat-widget-header">
                        <div class="chat-widget-header-avatar">
                            ${this.config.logoUrl ? `<img src="${this.config.logoUrl}" alt="Logo">` : ''}
                        </div>
                        <div class="chat-widget-header-title">
                            <h3>${this.config.companyName}</h3>
                            <span>Online</span>
                        </div>
                        <button class="chat-widget-close-btn">&times;</button>
                    </div>
                    <div class="chat-widget-messages"></div>
                    <div class="chat-widget-input-area">
                        <input type="text" placeholder="Type a message...">
                        <button aria-label="Send Message">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                `
            });
            
            const messagesContainer = this.elements.panel.querySelector('.chat-widget-messages');
            const welcomeMsgEl = this.createMessageElement('assistant', this.config.welcomeMessage);
            messagesContainer.appendChild(welcomeMsgEl);
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

            this.addMessageToUI('user', text);
            input.value = '';
            
            // ====================================================================
            // == FIXED: Call the real webhook instead of the echo placeholder ==
            // ====================================================================
            this.sendToWebhook(text);
        }
        
        async sendToWebhook(text) {
            if (!this.config.webhookUrl || this.config.webhookUrl.includes("YOUR_WEBHOOK_ID")) {
                console.error("Chat Widget: webhookUrl is not configured or is a placeholder.");
                this.addMessageToUI('assistant', "Error: Chat service is not configured correctly.");
                return;
            }

            this.isThinking = true;
            this.showTypingIndicator();

            try {
                const response = await fetch(this.config.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                // n8n often wraps responses, look for a content or message key
                const reply = data.content || data.message || "Sorry, I received an empty response.";
                this.addMessageToUI('assistant', reply);

            } catch (error) {
                console.error("Error calling webhook:", error);
                this.addMessageToUI('assistant', "Sorry, something went wrong. Please try again.");
            } finally {
                this.isThinking = false;
                this.hideTypingIndicator();
            }
        }

        toggle() {
            this.isOpen ? this.close() : this.open();
        }

        open() {
            this.elements.panel.classList.add('open');
            this.elements.button.classList.add('open');
            this.isOpen = true;
        }

        close() {
            this.elements.panel.classList.remove('open');
            this.elements.button.classList.remove('open');
            this.isOpen = false;
        }

        addMessageToUI(sender, text) {
            const messagesContainer = this.elements.panel.querySelector('.chat-widget-messages');
            const msgEl = this.createMessageElement(sender, text);
            messagesContainer.appendChild(msgEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        createMessageElement(sender, text) {
            const msgDiv = this.createElement('div', { className: `chat-widget-message ${sender}` });
            const p = this.createElement('p', { textContent: text });
            msgDiv.appendChild(p);
            return msgDiv;
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
        
        destroy() {
            if (this.elements.button) this.elements.button.remove();
            if (this.elements.panel) this.elements.panel.remove();
        }
    }

    window.ChatWidget = {
        init: (config) => {
            // This global singleton pattern helps manage the widget instance
            if (window.chatWidgetInstance) {
                 window.chatWidgetInstance.destroy();
                 window.chatWidgetInstance = null;
            }
            window.chatWidgetInstance = new ChatWidget(config);
            return window.chatWidgetInstance.init();
        }
    };

})(window);

