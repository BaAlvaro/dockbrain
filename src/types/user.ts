export interface UserContext {
  user_id: number;
  telegram_chat_id: string;
  display_name: string;
  is_active: boolean;
}

export interface PairingRequest {
  token: string;
  telegram_chat_id: string;
  username?: string;
  display_name: string;
}
