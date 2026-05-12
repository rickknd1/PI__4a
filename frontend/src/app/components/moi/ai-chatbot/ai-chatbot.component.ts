import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AiChatbotService, ChatMessage } from '../../../services/moi/ai-chatbot.service';
import { AiChatbotAdvancedService } from '../../../services/moi/ai-chatbot-advanced.service';
import { CHATBOT_CONFIG } from './ai-chatbot-config';

@Component({
  selector: 'app-ai-chatbot',
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chatbot.component.html',
  styleUrl: './ai-chatbot.component.css',
})
export class AiChatbotComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('inputField') private inputField!: ElementRef;

  isOpen = false;
  userInput = '';
  messages: ChatMessage[] = [];
  isTyping = false;
  hasUnreadMessages = false;
  showSuggestions = true;
  
  quickSuggestions = [
    "Quels sont les types d'élection ?",
    "Qui peut postuler ?",
    "Comment voter ?",
    "C'est quoi le comité Event ?"
  ];

  private messagesSubscription?: Subscription;
  private shouldScrollToBottom = false;
  private chatbotService: AiChatbotService | AiChatbotAdvancedService;

  constructor(
    private simpleService: AiChatbotService,
    private advancedService: AiChatbotAdvancedService
  ) {
    // Choisir le service selon la configuration
    this.chatbotService = CHATBOT_CONFIG.mode === 'advanced' 
      ? this.advancedService 
      : this.simpleService;
    
    console.log(`🤖 Mode chatbot: ${CHATBOT_CONFIG.mode}`);
  }

  ngOnInit(): void {
    // S'abonner aux messages
    this.messagesSubscription = this.chatbotService.messages$.subscribe(messages => {
      this.messages = messages;
      this.shouldScrollToBottom = true;
      
      // Marquer comme non lu si le chat est fermé
      if (!this.isOpen && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.sender === 'bot') {
          this.hasUnreadMessages = true;
        }
      }
      
      // Arrêter l'indicateur de frappe
      this.isTyping = false;
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.messagesSubscription?.unsubscribe();
  }

  /**
   * Ouvre/ferme le chatbot
   */
  toggleChat(): void {
    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      this.hasUnreadMessages = false;
      this.showSuggestions = this.messages.length <= 1;
      
      // Focus sur l'input après ouverture
      setTimeout(() => {
        this.inputField?.nativeElement.focus();
      }, 100);
    }
  }

  /**
   * Envoie un message
   */
  sendMessage(): void {
    if (!this.userInput.trim() || this.isTyping) return;

    const message = this.userInput.trim();
    this.userInput = '';
    this.showSuggestions = false;
    this.isTyping = true;

    // Envoyer le message au service
    this.chatbotService.sendMessage(message);
  }

  /**
   * Envoie une suggestion
   */
  sendSuggestion(suggestion: string): void {
    this.userInput = suggestion;
    this.sendMessage();
  }

  /**
   * Réinitialise la conversation
   */
  resetChat(): void {
    if (confirm('Voulez-vous vraiment réinitialiser la conversation ?')) {
      this.chatbotService.resetConversation();
      this.showSuggestions = true;
      this.userInput = '';
    }
  }

  /**
   * Formate le message pour l'affichage (Markdown simple)
   */
  formatMessage(text: string): string {
    return text
      // Gras
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italique
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Sauts de ligne
      .replace(/\n/g, '<br>')
      // Listes à puces
      .replace(/^• (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      // Emojis en plus grand
      .replace(/([\u{1F300}-\u{1F9FF}])/gu, '<span class="emoji">$1</span>');
  }

  /**
   * Scroll vers le bas des messages
   */
  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {
      console.error('Erreur scroll:', err);
    }
  }
}
