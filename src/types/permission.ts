export interface PermissionCheck {
  user_id: number;
  tool_name: string;
  action: string;
}

export interface PermissionSnapshot {
  [toolAndAction: string]: {
    granted: boolean;
    requires_confirmation: boolean;
  };
}
