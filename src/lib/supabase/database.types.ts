
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
                },"customers": {
                  Row: {
                    "address": string | null,"archived_at": string | null,"code": string,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"name": string,"notes": string | null,"phone": string,"phone_normalized": string | null,"shared_phone_confirmed": boolean,"updated_at": string,"whatsapp": string | null,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"archived_at"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"phone": string,"phone_normalized"?: never,"shared_phone_confirmed"?: boolean,"updated_at"?: string,"whatsapp"?: string | null,"workshop_id": string
                  }
                  Update: {
                    "address"?: string | null,"archived_at"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string,"phone_normalized"?: never,"shared_phone_confirmed"?: boolean,"updated_at"?: string,"whatsapp"?: string | null,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_workshop_id_fkey"
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
                },"role_permissions": {
                  Row: {
                    "permission": string,"role": Database["public"]['Enums']["workshop_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "permission": string,"role": Database["public"]['Enums']["workshop_role"]
                  }
                  Update: {
                    "permission"?: string,"role"?: Database["public"]['Enums']["workshop_role"]
                  }
                  Relationships: [
                    
                  ]
                },"vehicle_mileage_readings": {
                  Row: {
                    "id": string,"note": string | null,"reading": number,"recorded_at": string,"recorded_by": string | null,"source": string,"vehicle_id": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"note"?: string | null,"reading": number,"recorded_at"?: string,"recorded_by"?: string | null,"source"?: string,"vehicle_id": string,"workshop_id": string
                  }
                  Update: {
                    "id"?: string,"note"?: string | null,"reading"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"source"?: string,"vehicle_id"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_mileage_readings_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_mileage_readings_workshop_id_vehicle_id_fkey"
      columns: ["workshop_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "archived_at": string | null,"colour": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"duplicate_registration_reason": string | null,"engine_cc": number | null,"engine_number": string | null,"fuel_type": Database["public"]['Enums']["fuel_type"] | null,"id": string,"make": string,"model": string,"notes": string | null,"registration_normalized": string | null,"registration_number": string,"transmission": Database["public"]['Enums']["transmission_type"] | null,"updated_at": string,"variant": string | null,"vin": string | null,"workshop_id": string,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"colour"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"duplicate_registration_reason"?: string | null,"engine_cc"?: number | null,"engine_number"?: string | null,"fuel_type"?: Database["public"]['Enums']["fuel_type"] | null,"id"?: string,"make": string,"model": string,"notes"?: string | null,"registration_normalized"?: never,"registration_number": string,"transmission"?: Database["public"]['Enums']["transmission_type"] | null,"updated_at"?: string,"variant"?: string | null,"vin"?: string | null,"workshop_id": string,"year"?: number | null
                  }
                  Update: {
                    "archived_at"?: string | null,"colour"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"duplicate_registration_reason"?: string | null,"engine_cc"?: number | null,"engine_number"?: string | null,"fuel_type"?: Database["public"]['Enums']["fuel_type"] | null,"id"?: string,"make"?: string,"model"?: string,"notes"?: string | null,"registration_normalized"?: never,"registration_number"?: string,"transmission"?: Database["public"]['Enums']["transmission_type"] | null,"updated_at"?: string,"variant"?: string | null,"vin"?: string | null,"workshop_id"?: string,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicles_workshop_id_customer_id_fkey"
      columns: ["workshop_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "vehicles_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    }
                  ]
                },"workshop_counters": {
                  Row: {
                    "kind": string,"last_value": number,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "kind": string,"last_value"?: number,"workshop_id": string
                  }
                  Update: {
                    "kind"?: string,"last_value"?: number,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workshop_counters_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    }
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
"has_any_workshop_permission":
{ Args: { "perms": (string)[],"ws": string }; Returns: boolean
                           },
"has_workshop_permission":
{ Args: { "perm": string,"ws": string }; Returns: boolean
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
"next_workshop_number":
{ Args: { "p_kind": string,"ws": string }; Returns: number
                           },
"normalize_phone":
{ Args: { "p": string }; Returns: string
                           },
"normalize_registration":
{ Args: { "p": string }; Returns: string
                           },
"search_customers":
{ Args: { "include_archived"?: boolean,"p_limit"?: number,"p_offset"?: number,"q"?: string,"ws": string }; Returns: {
              "archived_at": string,"code": string,"created_at": string,"email": string,"id": string,"name": string,"phone": string,"total_count": number,"vehicle_count": number,"whatsapp": string
            }[]
                           },
"search_vehicles":
{ Args: { "include_archived"?: boolean,"p_limit"?: number,"p_offset"?: number,"q"?: string,"ws": string }; Returns: {
              "archived_at": string,"colour": string,"created_at": string,"current_mileage": number,"customer_id": string,"customer_name": string,"customer_phone": string,"id": string,"make": string,"model": string,"registration_number": string,"total_count": number,"variant": string,"year": number
            }[]
                           },
"shares_workshop_with":
{ Args: { "other": string }; Returns: boolean
                           }
          }
          Enums: {
            "fuel_type": "petrol"|"diesel"|"cng"|"lpg"|"hybrid"|"electric"|"other","transmission_type": "manual"|"automatic"|"other","workshop_role": "owner"|"advisor"|"mechanic"|"inventory_manager"|"cashier"
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
            "fuel_type": ["petrol", "diesel", "cng", "lpg", "hybrid", "electric", "other"],"transmission_type": ["manual", "automatic", "other"],"workshop_role": ["owner", "advisor", "mechanic", "inventory_manager", "cashier"]
          }
        }
} as const
