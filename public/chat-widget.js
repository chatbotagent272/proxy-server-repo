(function(window) {
    'use strict';

    class ChatWidget {
        constructor(config) {
            this.config = Object.assign({
                primaryColor: '#5B8DEF',
                companyName: 'Support',
                logoUrl: '',
                welcomeMessage: 'Hello! How can we help?',
                apiUrl: 'https://proxy-server-repo.vercel.app/api/chat', // Default API URL
                container: 'body'
            }, config);
            
            this.elements = {};
            this.isOpen = false;
            this.isThinking = false;
            // Use sessionStorage to maintain the session across page reloads
            this.sessionId = this.getSessionId();
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
            // Main button to open the widget
            this.elements.button = this.createElement('button', {
                className: 'chat-widget-button',
                ariaLabel: 'Toggle Chat Window',
                innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path></svg>`
            });

            // Main chat panel
            this.elements.panel = this.createElement('div', { className: 'chat-widget-panel' });
            
            // Create and append header, messages container, and input area safely
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
                innerHTML: '&times;',
                ariaLabel: 'Close Chat'
            });

            header.appendChild(avatarDiv);
            header.appendChild(titleDiv);
            header.appendChild(closeBtn);
            return header;
        }

        createMessagesContainer() {
            const messagesContainer = this.createElement('div', { className: 'chat-widget-messages' });
            const welcomeMsgEl = this.createMessageElement('assistant', this.config.welcomeMessage);
            messagesContainer.appendChild(welcomeMsgEl);
            return messagesContainer;
        }
        
        createInputArea() {
            const inputArea = this.createElement('div', { className: 'chat-widget-input-area' });
            const input = this.createElement('input', { type: 'text', placeholder: 'Type a message...' });
            const sendButton = this.createElement('button', { 
                ariaLabel: 'Send Message',
                innerHTML: `<svg class="chat-widget-send-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`
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

            this.addMessageToUI('user', text);
            input.value = '';
            
            this.sendToWebhook(text);
        }
        
        async sendToWebhook(text) {
            if (!this.config.apiUrl) {
                console.error("Chat Widget: apiUrl is not configured.");
                this.addMessageToUI('assistant', "Error: Chat service is not configured correctly.");
                return;
            }

            this.isThinking = true;
            this.showTypingIndicator();

            try {
                const response = await fetch(this.config.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: text,
                        user: {
                            sessionId: this.sessionId
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const reply = this.extractReply(data);
                this.addMessageToUI('assistant', reply);

            } catch (error) {
                console.error("Error calling API:", error);
                this.addMessageToUI('assistant', "Sorry, something went wrong. Please try again.");
            } finally {
                this.isThinking = false;
                this.hideTypingIndicator();
            }
        }

        extractReply(data) {
            // More robustly check for the reply in various n8n response structures
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
        
        getSessionId() {
            let sessionId = sessionStorage.getItem('chat_widget_session_id');
            if (!sessionId) {
                sessionId = this.generateUUID();
                sessionStorage.setItem('chat_widget_session_id', sessionId);
            }
            return sessionId;
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

