export interface IncomingMessage {
  message_id: number;
  chat_id: string;
  text: string;
  user_display_name: string;
  username?: string;
  timestamp: number;
}

export interface MessageDedupKey {
  telegram_message_id: number;
  telegram_chat_id: string;
}
