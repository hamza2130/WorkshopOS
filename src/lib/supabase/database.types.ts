
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"metadata": NonNullable<Json>,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"metadata"?: NonNullable<Json>,"workshop_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_logs_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workshop_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"revoked_at": string | null,"role": Database["public"]['Enums']["workshop_role"],"token_hash": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by": string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["workshop_role"],"token_hash": string,"workshop_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["workshop_role"],"token_hash"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workshop_invitations_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workshop_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workshop_invitations_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    }
                  ]
                },"workshop_members": {
                  Row: {
                    "created_at": string,"extra_permissions": (string)[],"id": string,"is_active": boolean,"role": Database["public"]['Enums']["workshop_role"],"updated_at": string,"user_id": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"extra_permissions"?: (string)[],"id"?: string,"is_active"?: boolean,"role": Database["public"]['Enums']["workshop_role"],"updated_at"?: string,"user_id": string,"workshop_id": string
                  }
                  Update: {
                    "created_at"?: string,"extra_permissions"?: (string)[],"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["workshop_role"],"updated_at"?: string,"user_id"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workshop_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workshop_members_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    }
                  ]
                },"workshops": {
                  Row: {
                    "address": string | null,"city": string | null,"country": string,"created_at": string,"currency": string,"email": string | null,"id": string,"invoice_prefix": string,"job_card_prefix": string,"logo_path": string | null,"name": string,"phone": string | null,"tax_label": string,"tax_rate": number,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"country"?: string,"created_at"?: string,"currency"?: string,"email"?: string | null,"id"?: string,"invoice_prefix"?: string,"job_card_prefix"?: string,"logo_path"?: string | null,"name": string,"phone"?: string | null,"tax_label"?: string,"tax_rate"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"country"?: string,"created_at"?: string,"currency"?: string,"email"?: string | null,"id"?: string,"invoice_prefix"?: string,"job_card_prefix"?: string,"logo_path"?: string | null,"name"?: string,"phone"?: string | null,"tax_label"?: string,"tax_rate"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"create_invitation":
{ Args: { "p_email": string,"p_role": Database["public"]['Enums']["workshop_role"],"ws": string }; Returns: string
                           },
"create_workshop":
{ Args: { "p_address"?: string,"p_city"?: string,"p_country"?: string,"p_currency"?: string,"p_email"?: string,"p_invoice_prefix"?: string,"p_job_card_prefix"?: string,"p_name": string,"p_phone"?: string,"p_tax_label"?: string,"p_tax_rate"?: number,"p_timezone"?: string }; Returns: string
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: {
              "email": string,"role": Database["public"]['Enums']["workshop_role"],"status": string,"workshop_name": string
            }[]
                           },
"has_workshop_role":
{ Args: { "roles": (Database["public"]['Enums']["workshop_role"])[],"ws": string }; Returns: boolean
                           },
"is_workshop_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"log_activity":
{ Args: { "p_action": string,"p_entity_id": string,"p_entity_type": string,"p_metadata"?: Json,"ws": string }; Returns: undefined
                           },
"shares_workshop_with":
{ Args: { "other": string }; Returns: boolean
                           }
          }
          Enums: {
            "workshop_role": "owner"|"advisor"|"mechanic"|"inventory_manager"|"cashier"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "workshop_role": ["owner", "advisor", "mechanic", "inventory_manager", "cashier"]
          }
        }
} as const
