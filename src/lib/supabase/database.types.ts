
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
                },"estimate_decisions": {
                  Row: {
                    "approved_item_ids": (string)[],"approved_total": number,"customer_name": string | null,"decided_at": string,"decision": Database["public"]['Enums']["estimate_status"],"declined_item_ids": (string)[],"estimate_id": string,"id": string,"method": Database["public"]['Enums']["decision_method"],"note": string | null,"recorded_by": string | null,"version": number,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_item_ids"?: (string)[],"approved_total": number,"customer_name"?: string | null,"decided_at"?: string,"decision": Database["public"]['Enums']["estimate_status"],"declined_item_ids"?: (string)[],"estimate_id": string,"id"?: string,"method": Database["public"]['Enums']["decision_method"],"note"?: string | null,"recorded_by"?: string | null,"version": number,"workshop_id": string
                  }
                  Update: {
                    "approved_item_ids"?: (string)[],"approved_total"?: number,"customer_name"?: string | null,"decided_at"?: string,"decision"?: Database["public"]['Enums']["estimate_status"],"declined_item_ids"?: (string)[],"estimate_id"?: string,"id"?: string,"method"?: Database["public"]['Enums']["decision_method"],"note"?: string | null,"recorded_by"?: string | null,"version"?: number,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "estimate_decisions_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estimate_decisions_workshop_id_estimate_id_fkey"
      columns: ["workshop_id","estimate_id"]
isOneToOne: false
      referencedRelation: "estimates"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"estimate_items": {
                  Row: {
                    "approval_status": Database["public"]['Enums']["approval_status"],"created_at": string,"description": string,"discount": number,"estimate_id": string,"id": string,"inspection_category": Database["public"]['Enums']["inspection_category"] | null,"kind": Database["public"]['Enums']["estimate_item_kind"],"labour_item_id": string | null,"line_subtotal": number | null,"line_total": number | null,"part_id": string | null,"part_number": string | null,"position": number,"quantity": number,"source": Database["public"]['Enums']["estimate_item_source"],"taxable": boolean,"unit_price": number,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_status"?: Database["public"]['Enums']["approval_status"],"created_at"?: string,"description": string,"discount"?: number,"estimate_id": string,"id"?: string,"inspection_category"?: Database["public"]['Enums']["inspection_category"] | null,"kind": Database["public"]['Enums']["estimate_item_kind"],"labour_item_id"?: string | null,"line_subtotal"?: never,"line_total"?: never,"part_id"?: string | null,"part_number"?: string | null,"position"?: number,"quantity"?: number,"source"?: Database["public"]['Enums']["estimate_item_source"],"taxable"?: boolean,"unit_price": number,"workshop_id": string
                  }
                  Update: {
                    "approval_status"?: Database["public"]['Enums']["approval_status"],"created_at"?: string,"description"?: string,"discount"?: number,"estimate_id"?: string,"id"?: string,"inspection_category"?: Database["public"]['Enums']["inspection_category"] | null,"kind"?: Database["public"]['Enums']["estimate_item_kind"],"labour_item_id"?: string | null,"line_subtotal"?: never,"line_total"?: never,"part_id"?: string | null,"part_number"?: string | null,"position"?: number,"quantity"?: number,"source"?: Database["public"]['Enums']["estimate_item_source"],"taxable"?: boolean,"unit_price"?: number,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "estimate_items_workshop_id_estimate_id_fkey"
      columns: ["workshop_id","estimate_id"]
isOneToOne: false
      referencedRelation: "estimates"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "estimate_items_workshop_id_labour_item_id_fkey"
      columns: ["workshop_id","labour_item_id"]
isOneToOne: false
      referencedRelation: "labour_items"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "estimate_items_workshop_id_part_id_fkey"
      columns: ["workshop_id","part_id"]
isOneToOne: false
      referencedRelation: "parts"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"estimates": {
                  Row: {
                    "approval_expires_at": string | null,"approval_token_hash": string | null,"closed_at": string | null,"created_at": string,"created_by": string | null,"customer_note": string | null,"decided_at": string | null,"discount_total": number,"estimated_completion": string | null,"id": string,"job_card_id": string,"sent_at": string | null,"sent_by": string | null,"status": Database["public"]['Enums']["estimate_status"],"subtotal": number,"tax_label": string,"tax_rate": number,"tax_total": number,"terms": string | null,"total": number,"updated_at": string,"version": number,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_expires_at"?: string | null,"approval_token_hash"?: string | null,"closed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_note"?: string | null,"decided_at"?: string | null,"discount_total"?: number,"estimated_completion"?: string | null,"id"?: string,"job_card_id": string,"sent_at"?: string | null,"sent_by"?: string | null,"status"?: Database["public"]['Enums']["estimate_status"],"subtotal"?: number,"tax_label": string,"tax_rate": number,"tax_total"?: number,"terms"?: string | null,"total"?: number,"updated_at"?: string,"version": number,"workshop_id": string
                  }
                  Update: {
                    "approval_expires_at"?: string | null,"approval_token_hash"?: string | null,"closed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_note"?: string | null,"decided_at"?: string | null,"discount_total"?: number,"estimated_completion"?: string | null,"id"?: string,"job_card_id"?: string,"sent_at"?: string | null,"sent_by"?: string | null,"status"?: Database["public"]['Enums']["estimate_status"],"subtotal"?: number,"tax_label"?: string,"tax_rate"?: number,"tax_total"?: number,"terms"?: string | null,"total"?: number,"updated_at"?: string,"version"?: number,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "estimates_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estimates_sent_by_fkey"
      columns: ["sent_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "estimates_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"invoice_items": {
                  Row: {
                    "created_at": string,"description": string,"discount": number,"estimate_item_id": string | null,"id": string,"invoice_id": string,"kind": Database["public"]['Enums']["estimate_item_kind"],"line_subtotal": number | null,"line_total": number | null,"part_id": string | null,"part_number": string | null,"position": number,"quantity": number,"source": Database["public"]['Enums']["invoice_line_source"],"taxable": boolean,"unit_price": number,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"discount"?: number,"estimate_item_id"?: string | null,"id"?: string,"invoice_id": string,"kind": Database["public"]['Enums']["estimate_item_kind"],"line_subtotal"?: never,"line_total"?: never,"part_id"?: string | null,"part_number"?: string | null,"position"?: number,"quantity"?: number,"source"?: Database["public"]['Enums']["invoice_line_source"],"taxable"?: boolean,"unit_price": number,"workshop_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"discount"?: number,"estimate_item_id"?: string | null,"id"?: string,"invoice_id"?: string,"kind"?: Database["public"]['Enums']["estimate_item_kind"],"line_subtotal"?: never,"line_total"?: never,"part_id"?: string | null,"part_number"?: string | null,"position"?: number,"quantity"?: number,"source"?: Database["public"]['Enums']["invoice_line_source"],"taxable"?: boolean,"unit_price"?: number,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_items_workshop_id_estimate_item_id_fkey"
      columns: ["workshop_id","estimate_item_id"]
isOneToOne: false
      referencedRelation: "estimate_items"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "invoice_items_workshop_id_invoice_id_fkey"
      columns: ["workshop_id","invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "invoice_items_workshop_id_part_id_fkey"
      columns: ["workshop_id","part_id"]
isOneToOne: false
      referencedRelation: "parts"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount_paid": number,"balance_due": number | null,"created_at": string,"created_by": string | null,"customer_id": string,"customer_name": string | null,"customer_phone": string | null,"discount_total": number,"estimate_id": string | null,"id": string,"invoice_number": string | null,"issued_at": string | null,"issued_by": string | null,"job_card_id": string,"notes": string | null,"odometer": number | null,"status": Database["public"]['Enums']["invoice_status"],"subtotal": number,"tax_label": string,"tax_rate": number,"tax_total": number,"total": number,"updated_at": string,"vehicle_description": string | null,"vehicle_id": string,"vehicle_registration": string | null,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paid"?: number,"balance_due"?: never,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"customer_name"?: string | null,"customer_phone"?: string | null,"discount_total"?: number,"estimate_id"?: string | null,"id"?: string,"invoice_number"?: string | null,"issued_at"?: string | null,"issued_by"?: string | null,"job_card_id": string,"notes"?: string | null,"odometer"?: number | null,"status"?: Database["public"]['Enums']["invoice_status"],"subtotal"?: number,"tax_label": string,"tax_rate": number,"tax_total"?: number,"total"?: number,"updated_at"?: string,"vehicle_description"?: string | null,"vehicle_id": string,"vehicle_registration"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null,"workshop_id": string
                  }
                  Update: {
                    "amount_paid"?: number,"balance_due"?: never,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"customer_name"?: string | null,"customer_phone"?: string | null,"discount_total"?: number,"estimate_id"?: string | null,"id"?: string,"invoice_number"?: string | null,"issued_at"?: string | null,"issued_by"?: string | null,"job_card_id"?: string,"notes"?: string | null,"odometer"?: number | null,"status"?: Database["public"]['Enums']["invoice_status"],"subtotal"?: number,"tax_label"?: string,"tax_rate"?: number,"tax_total"?: number,"total"?: number,"updated_at"?: string,"vehicle_description"?: string | null,"vehicle_id"?: string,"vehicle_registration"?: string | null,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_workshop_id_customer_id_fkey"
      columns: ["workshop_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "invoices_workshop_id_estimate_id_fkey"
      columns: ["workshop_id","estimate_id"]
isOneToOne: false
      referencedRelation: "estimates"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "invoices_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "invoices_workshop_id_vehicle_id_fkey"
      columns: ["workshop_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_attachments": {
                  Row: {
                    "caption": string | null,"category": string,"content_type": string,"file_name": string,"id": string,"job_card_id": string,"removed_at": string | null,"removed_by": string | null,"size_bytes": number,"storage_path": string,"uploaded_at": string,"uploaded_by": string | null,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"category"?: string,"content_type": string,"file_name": string,"id"?: string,"job_card_id": string,"removed_at"?: string | null,"removed_by"?: string | null,"size_bytes": number,"storage_path": string,"uploaded_at"?: string,"uploaded_by"?: string | null,"workshop_id": string
                  }
                  Update: {
                    "caption"?: string | null,"category"?: string,"content_type"?: string,"file_name"?: string,"id"?: string,"job_card_id"?: string,"removed_at"?: string | null,"removed_by"?: string | null,"size_bytes"?: number,"storage_path"?: string,"uploaded_at"?: string,"uploaded_by"?: string | null,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_attachments_removed_by_fkey"
      columns: ["removed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_attachments_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_cards": {
                  Row: {
                    "cancelled_at": string | null,"check_in_at": string,"check_in_mileage": number | null,"complaint": string,"created_at": string,"created_by": string | null,"customer_id": string,"delivered_at": string | null,"expected_delivery_at": string | null,"fuel_level": Database["public"]['Enums']["fuel_level"] | null,"id": string,"initial_observations": string | null,"job_number": string,"on_hold_from": Database["public"]['Enums']["job_status"] | null,"service_advisor_id": string | null,"status": Database["public"]['Enums']["job_status"],"status_changed_at": string,"updated_at": string,"vehicle_id": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"check_in_at"?: string,"check_in_mileage"?: number | null,"complaint": string,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"delivered_at"?: string | null,"expected_delivery_at"?: string | null,"fuel_level"?: Database["public"]['Enums']["fuel_level"] | null,"id"?: string,"initial_observations"?: string | null,"job_number"?: string,"on_hold_from"?: Database["public"]['Enums']["job_status"] | null,"service_advisor_id"?: string | null,"status"?: Database["public"]['Enums']["job_status"],"status_changed_at"?: string,"updated_at"?: string,"vehicle_id": string,"workshop_id": string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"check_in_at"?: string,"check_in_mileage"?: number | null,"complaint"?: string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"delivered_at"?: string | null,"expected_delivery_at"?: string | null,"fuel_level"?: Database["public"]['Enums']["fuel_level"] | null,"id"?: string,"initial_observations"?: string | null,"job_number"?: string,"on_hold_from"?: Database["public"]['Enums']["job_status"] | null,"service_advisor_id"?: string | null,"status"?: Database["public"]['Enums']["job_status"],"status_changed_at"?: string,"updated_at"?: string,"vehicle_id"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_cards_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_cards_service_advisor_id_fkey"
      columns: ["service_advisor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_cards_workshop_id_customer_id_fkey"
      columns: ["workshop_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "job_cards_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_cards_workshop_id_vehicle_id_fkey"
      columns: ["workshop_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_inspection_items": {
                  Row: {
                    "category": Database["public"]['Enums']["inspection_category"],"id": string,"inspection_id": string,"notes": string | null,"outcome": Database["public"]['Enums']["inspection_outcome"],"updated_at": string,"updated_by": string | null,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": Database["public"]['Enums']["inspection_category"],"id"?: string,"inspection_id": string,"notes"?: string | null,"outcome"?: Database["public"]['Enums']["inspection_outcome"],"updated_at"?: string,"updated_by"?: string | null,"workshop_id": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["inspection_category"],"id"?: string,"inspection_id"?: string,"notes"?: string | null,"outcome"?: Database["public"]['Enums']["inspection_outcome"],"updated_at"?: string,"updated_by"?: string | null,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_inspection_items_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_inspection_items_workshop_id_inspection_id_fkey"
      columns: ["workshop_id","inspection_id"]
isOneToOne: false
      referencedRelation: "job_inspections"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_inspections": {
                  Row: {
                    "completed_at": string | null,"completed_by": string | null,"id": string,"job_card_id": string,"started_at": string,"started_by": string | null,"summary": string | null,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"id"?: string,"job_card_id": string,"started_at"?: string,"started_by"?: string | null,"summary"?: string | null,"workshop_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"id"?: string,"job_card_id"?: string,"started_at"?: string,"started_by"?: string | null,"summary"?: string | null,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_inspections_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_inspections_started_by_fkey"
      columns: ["started_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_inspections_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_notes": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"id": string,"job_card_id": string,"visibility": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"job_card_id": string,"visibility"?: string,"workshop_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"job_card_id"?: string,"visibility"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_notes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_notes_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_parts_used": {
                  Row: {
                    "description": string,"estimate_item_id": string | null,"id": string,"job_card_id": string,"note": string | null,"part_id": string | null,"quantity": number,"recorded_at": string,"recorded_by": string | null,"removed_at": string | null,"removed_by": string | null,"task_id": string | null,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"estimate_item_id"?: string | null,"id"?: string,"job_card_id": string,"note"?: string | null,"part_id"?: string | null,"quantity": number,"recorded_at"?: string,"recorded_by"?: string | null,"removed_at"?: string | null,"removed_by"?: string | null,"task_id"?: string | null,"workshop_id": string
                  }
                  Update: {
                    "description"?: string,"estimate_item_id"?: string | null,"id"?: string,"job_card_id"?: string,"note"?: string | null,"part_id"?: string | null,"quantity"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"removed_at"?: string | null,"removed_by"?: string | null,"task_id"?: string | null,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_parts_used_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_parts_used_removed_by_fkey"
      columns: ["removed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_parts_used_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "job_parts_used_workshop_id_part_id_fkey"
      columns: ["workshop_id","part_id"]
isOneToOne: false
      referencedRelation: "parts"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "job_parts_used_workshop_id_task_id_fkey"
      columns: ["workshop_id","task_id"]
isOneToOne: false
      referencedRelation: "job_tasks"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_status_actions": {
                  Row: {
                    "code": string,"from_status": Database["public"]['Enums']["job_status"],"label": string,"permission": string,"requires_reason": boolean,"sort_order": number,"to_status": Database["public"]['Enums']["job_status"] | null,"tone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"from_status": Database["public"]['Enums']["job_status"],"label": string,"permission"?: string,"requires_reason"?: boolean,"sort_order"?: number,"to_status"?: Database["public"]['Enums']["job_status"] | null,"tone"?: string
                  }
                  Update: {
                    "code"?: string,"from_status"?: Database["public"]['Enums']["job_status"],"label"?: string,"permission"?: string,"requires_reason"?: boolean,"sort_order"?: number,"to_status"?: Database["public"]['Enums']["job_status"] | null,"tone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"job_status_history": {
                  Row: {
                    "action": string,"changed_at": string,"changed_by": string | null,"from_status": Database["public"]['Enums']["job_status"] | null,"id": number,"job_card_id": string,"reason": string | null,"to_status": Database["public"]['Enums']["job_status"],"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"changed_at"?: string,"changed_by"?: string | null,"from_status"?: Database["public"]['Enums']["job_status"] | null,"id"?: never,"job_card_id": string,"reason"?: string | null,"to_status": Database["public"]['Enums']["job_status"],"workshop_id": string
                  }
                  Update: {
                    "action"?: string,"changed_at"?: string,"changed_by"?: string | null,"from_status"?: Database["public"]['Enums']["job_status"] | null,"id"?: never,"job_card_id"?: string,"reason"?: string | null,"to_status"?: Database["public"]['Enums']["job_status"],"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_status_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_status_history_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_task_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"from_status": Database["public"]['Enums']["task_status"] | null,"id": number,"job_card_id": string,"reason": string | null,"task_id": string,"to_status": Database["public"]['Enums']["task_status"],"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"from_status"?: Database["public"]['Enums']["task_status"] | null,"id"?: never,"job_card_id": string,"reason"?: string | null,"task_id": string,"to_status": Database["public"]['Enums']["task_status"],"workshop_id": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"from_status"?: Database["public"]['Enums']["task_status"] | null,"id"?: never,"job_card_id"?: string,"reason"?: string | null,"task_id"?: string,"to_status"?: Database["public"]['Enums']["task_status"],"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_task_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_task_history_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "job_task_history_workshop_id_task_id_fkey"
      columns: ["workshop_id","task_id"]
isOneToOne: false
      referencedRelation: "job_tasks"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"job_tasks": {
                  Row: {
                    "assignee_id": string | null,"blocked_at": string | null,"blocked_reason": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"description": string | null,"estimate_item_id": string | null,"expected_completion_at": string | null,"id": string,"job_card_id": string,"position": number,"priority": Database["public"]['Enums']["task_priority"],"started_at": string | null,"status": Database["public"]['Enums']["task_status"],"status_changed_at": string,"title": string,"updated_at": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"blocked_at"?: string | null,"blocked_reason"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"estimate_item_id"?: string | null,"expected_completion_at"?: string | null,"id"?: string,"job_card_id": string,"position"?: number,"priority"?: Database["public"]['Enums']["task_priority"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"status_changed_at"?: string,"title": string,"updated_at"?: string,"workshop_id": string
                  }
                  Update: {
                    "assignee_id"?: string | null,"blocked_at"?: string | null,"blocked_reason"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"estimate_item_id"?: string | null,"expected_completion_at"?: string | null,"id"?: string,"job_card_id"?: string,"position"?: number,"priority"?: Database["public"]['Enums']["task_priority"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"status_changed_at"?: string,"title"?: string,"updated_at"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_tasks_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"labour_items": {
                  Row: {
                    "created_at": string,"default_price": number,"description": string | null,"estimated_minutes": number | null,"id": string,"is_active": boolean,"name": string,"updated_at": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_price"?: number,"description"?: string | null,"estimated_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"name": string,"updated_at"?: string,"workshop_id": string
                  }
                  Update: {
                    "created_at"?: string,"default_price"?: number,"description"?: string | null,"estimated_minutes"?: number | null,"id"?: string,"is_active"?: boolean,"name"?: string,"updated_at"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "labour_items_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"recipient_id": string,"title": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"read_at"?: string | null,"recipient_id": string,"title": string,"workshop_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"recipient_id"?: string,"title"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    }
                  ]
                },"parts": {
                  Row: {
                    "brand": string | null,"category": string | null,"cost_price": number | null,"created_at": string,"id": string,"is_active": boolean,"location": string | null,"name": string,"part_number": string | null,"reorder_level": number | null,"selling_price": number,"stock_on_hand": number,"supplier": string | null,"track_stock": boolean,"unit": string,"updated_at": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"category"?: string | null,"cost_price"?: number | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location"?: string | null,"name": string,"part_number"?: string | null,"reorder_level"?: number | null,"selling_price"?: number,"stock_on_hand"?: number,"supplier"?: string | null,"track_stock"?: boolean,"unit"?: string,"updated_at"?: string,"workshop_id": string
                  }
                  Update: {
                    "brand"?: string | null,"category"?: string | null,"cost_price"?: number | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location"?: string | null,"name"?: string,"part_number"?: string | null,"reorder_level"?: number | null,"selling_price"?: number,"stock_on_hand"?: number,"supplier"?: string | null,"track_stock"?: boolean,"unit"?: string,"updated_at"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parts_workshop_id_fkey"
      columns: ["workshop_id"]
isOneToOne: false
      referencedRelation: "workshops"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"id": string,"invoice_id": string,"kind": Database["public"]['Enums']["payment_kind"],"method": Database["public"]['Enums']["payment_method"],"note": string | null,"received_at": string,"recorded_by": string | null,"reference": string | null,"refund_of": string | null,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"id"?: string,"invoice_id": string,"kind"?: Database["public"]['Enums']["payment_kind"],"method": Database["public"]['Enums']["payment_method"],"note"?: string | null,"received_at"?: string,"recorded_by"?: string | null,"reference"?: string | null,"refund_of"?: string | null,"workshop_id": string
                  }
                  Update: {
                    "amount"?: number,"id"?: string,"invoice_id"?: string,"kind"?: Database["public"]['Enums']["payment_kind"],"method"?: Database["public"]['Enums']["payment_method"],"note"?: string | null,"received_at"?: string,"recorded_by"?: string | null,"reference"?: string | null,"refund_of"?: string | null,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_workshop_id_invoice_id_fkey"
      columns: ["workshop_id","invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "payments_workshop_id_refund_of_fkey"
      columns: ["workshop_id","refund_of"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["workshop_id","id"]
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
                },"stock_movements": {
                  Row: {
                    "balance_after": number,"created_at": string,"created_by": string | null,"id": number,"job_card_id": string | null,"kind": Database["public"]['Enums']["stock_movement_kind"],"part_id": string,"part_used_id": string | null,"quantity": number,"reason": string | null,"reference": string | null,"supplier": string | null,"unit_cost": number | null,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "balance_after": number,"created_at"?: string,"created_by"?: string | null,"id"?: never,"job_card_id"?: string | null,"kind": Database["public"]['Enums']["stock_movement_kind"],"part_id": string,"part_used_id"?: string | null,"quantity": number,"reason"?: string | null,"reference"?: string | null,"supplier"?: string | null,"unit_cost"?: number | null,"workshop_id": string
                  }
                  Update: {
                    "balance_after"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: never,"job_card_id"?: string | null,"kind"?: Database["public"]['Enums']["stock_movement_kind"],"part_id"?: string,"part_used_id"?: string | null,"quantity"?: number,"reason"?: string | null,"reference"?: string | null,"supplier"?: string | null,"unit_cost"?: number | null,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_workshop_id_job_card_id_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "stock_movements_workshop_id_part_id_fkey"
      columns: ["workshop_id","part_id"]
isOneToOne: false
      referencedRelation: "parts"
      referencedColumns: ["workshop_id","id"]
    },{
      foreignKeyName: "stock_movements_workshop_id_part_used_id_fkey"
      columns: ["workshop_id","part_used_id"]
isOneToOne: false
      referencedRelation: "job_parts_used"
      referencedColumns: ["workshop_id","id"]
    }
                  ]
                },"vehicle_mileage_readings": {
                  Row: {
                    "id": string,"job_card_id": string | null,"note": string | null,"reading": number,"recorded_at": string,"recorded_by": string | null,"source": string,"vehicle_id": string,"workshop_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"job_card_id"?: string | null,"note"?: string | null,"reading": number,"recorded_at"?: string,"recorded_by"?: string | null,"source"?: string,"vehicle_id": string,"workshop_id": string
                  }
                  Update: {
                    "id"?: string,"job_card_id"?: string | null,"note"?: string | null,"reading"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"source"?: string,"vehicle_id"?: string,"workshop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_mileage_readings_job_card_fkey"
      columns: ["workshop_id","job_card_id"]
isOneToOne: false
      referencedRelation: "job_cards"
      referencedColumns: ["workshop_id","id"]
    },{
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
"apply_estimate_decision":
{ Args: { "p_approved": (string)[],"p_customer_name": string,"p_estimate": string,"p_method": Database["public"]['Enums']["decision_method"],"p_note": string,"p_recorded_by": string }; Returns: Database["public"]['Enums']["estimate_status"]
                           },
"apply_stock_movement":
{ Args: { "p_job"?: string,"p_kind": Database["public"]['Enums']["stock_movement_kind"],"p_part": string,"p_part_used"?: string,"p_quantity": number,"p_reason"?: string,"p_reference"?: string,"p_supplier"?: string,"p_unit_cost"?: number }; Returns: number
                           },
"billing_summary":
{ Args: { "p_from": string,"p_to": string,"ws": string }; Returns: {
              "collected": number,"invoice_count": number,"invoiced": number,"outstanding": number,"unpaid_count": number
            }[]
                           },
"can_upload_job_attachment":
{ Args: { "object_name": string }; Returns: boolean
                           },
"can_work_on_job":
{ Args: { "p_job": string }; Returns: boolean
                           },
"change_job_status":
{ Args: { "p_action": string,"p_expected_status": Database["public"]['Enums']["job_status"],"p_job": string,"p_reason"?: string }; Returns: Database["public"]['Enums']["job_status"]
                           },
"complete_inspection":
{ Args: { "p_job": string,"p_summary"?: string }; Returns: undefined
                           },
"count_stock":
{ Args: { "p_counted": number,"p_part": string,"p_reason": string }; Returns: number
                           },
"create_estimate":
{ Args: { "p_job": string,"p_reason"?: string }; Returns: string
                           },
"create_invitation":
{ Args: { "p_email": string,"p_role": Database["public"]['Enums']["workshop_role"],"ws": string }; Returns: string
                           },
"create_invoice":
{ Args: { "p_job": string }; Returns: string
                           },
"create_job_card":
{ Args: { "p_advisor"?: string,"p_as_draft"?: boolean,"p_complaint": string,"p_expected_delivery"?: string,"p_fuel_level"?: Database["public"]['Enums']["fuel_level"],"p_mileage"?: number,"p_mileage_note"?: string,"p_observations"?: string,"p_vehicle": string,"ws": string }; Returns: string
                           },
"create_tasks_from_estimate":
{ Args: { "p_assignee"?: string,"p_job": string }; Returns: number
                           },
"create_workshop":
{ Args: { "p_address"?: string,"p_city"?: string,"p_country"?: string,"p_currency"?: string,"p_email"?: string,"p_invoice_prefix"?: string,"p_job_card_prefix"?: string,"p_name": string,"p_phone"?: string,"p_tax_label"?: string,"p_tax_rate"?: number,"p_timezone"?: string }; Returns: string
                           },
"get_assigned_job":
{ Args: { "p_job": string }; Returns: Json
                           },
"get_estimate_for_customer":
{ Args: { "p_token": string }; Returns: Json
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
"is_assigned_to_job":
{ Args: { "p_job": string }; Returns: boolean
                           },
"is_workshop_member":
{ Args: { "ws": string }; Returns: boolean
                           },
"issue_invoice":
{ Args: { "p_invoice": string }; Returns: string
                           },
"job_attachment_object_exists":
{ Args: { "object_name": string }; Returns: boolean
                           },
"job_status_counts":
{ Args: { "ws": string }; Returns: {
              "job_count": number,"status": Database["public"]['Enums']["job_status"]
            }[]
                           },
"log_activity":
{ Args: { "p_action": string,"p_entity_id": string,"p_entity_type": string,"p_metadata"?: Json,"ws": string }; Returns: undefined
                           },
"looks_like_phone":
{ Args: { "q": string }; Returns: boolean
                           },
"low_stock_parts":
{ Args: { "ws": string }; Returns: {
              "id": string,"name": string,"part_number": string,"reorder_level": number,"stock_on_hand": number,"unit": string
            }[]
                           },
"member_has_permission":
{ Args: { "p_user": string,"perm": string,"ws": string }; Returns: boolean
                           },
"my_assigned_jobs":
{ Args: { "p_include_closed"?: boolean,"ws": string }; Returns: {
              "colour": string,"complaint": string,"expected_delivery_at": string,"id": string,"job_number": string,"last_activity_at": string,"make": string,"model": string,"my_blocked_tasks": number,"my_open_tasks": number,"my_total_tasks": number,"next_due_at": string,"next_task": string,"registration_number": string,"status": Database["public"]['Enums']["job_status"],"top_priority": Database["public"]['Enums']["task_priority"]
            }[]
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
"notify_job_staff":
{ Args: { "p_body": string,"p_job": string,"p_kind": string,"p_title": string }; Returns: undefined
                           },
"notify_low_stock":
{ Args: { "p_balance": number,"p_part": Omit<Database["public"]['Tables']["parts"]['Row'], Database["public"]['Tables']["parts"]['ComputedFields']> }; Returns: undefined
                           },
"recalculate_estimate":
{ Args: { "p_estimate": string }; Returns: undefined
                           },
"recalculate_invoice":
{ Args: { "p_invoice": string }; Returns: undefined
                           },
"receive_stock":
{ Args: { "p_part": string,"p_quantity": number,"p_reference"?: string,"p_supplier"?: string,"p_unit_cost"?: number }; Returns: number
                           },
"record_estimate_decision":
{ Args: { "p_approved": (string)[],"p_estimate": string,"p_method": Database["public"]['Enums']["decision_method"],"p_note"?: string }; Returns: Database["public"]['Enums']["estimate_status"]
                           },
"record_payment":
{ Args: { "p_amount": number,"p_invoice": string,"p_method": Database["public"]['Enums']["payment_method"],"p_note"?: string,"p_reference"?: string }; Returns: string
                           },
"refund_payment":
{ Args: { "p_amount": number,"p_method": Database["public"]['Enums']["payment_method"],"p_payment": string,"p_reason": string }; Returns: string
                           },
"renew_estimate_link":
{ Args: { "p_estimate": string,"p_valid_days"?: number }; Returns: string
                           },
"respond_to_estimate":
{ Args: { "p_approved": (string)[],"p_customer_name": string,"p_token": string }; Returns: Database["public"]['Enums']["estimate_status"]
                           },
"search_customers":
{ Args: { "include_archived"?: boolean,"p_limit"?: number,"p_offset"?: number,"q"?: string,"ws": string }; Returns: {
              "archived_at": string,"code": string,"created_at": string,"email": string,"id": string,"job_count": number,"last_visit": string,"name": string,"phone": string,"total_count": number,"vehicle_count": number,"whatsapp": string
            }[]
                           },
"search_job_cards":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_statuses"?: (Database["public"]['Enums']["job_status"])[],"q"?: string,"ws": string }; Returns: {
              "advisor_name": string,"check_in_at": string,"complaint": string,"customer_id": string,"customer_name": string,"customer_phone": string,"expected_delivery_at": string,"id": string,"job_number": string,"make": string,"model": string,"registration_number": string,"status": Database["public"]['Enums']["job_status"],"status_changed_at": string,"total_count": number,"vehicle_id": string
            }[]
                           },
"search_vehicles":
{ Args: { "include_archived"?: boolean,"p_limit"?: number,"p_offset"?: number,"q"?: string,"ws": string }; Returns: {
              "archived_at": string,"colour": string,"created_at": string,"current_mileage": number,"customer_id": string,"customer_name": string,"customer_phone": string,"id": string,"make": string,"model": string,"registration_number": string,"total_count": number,"variant": string,"year": number
            }[]
                           },
"send_estimate":
{ Args: { "p_estimate": string,"p_valid_days"?: number }; Returns: string
                           },
"shares_workshop_with":
{ Args: { "other": string }; Returns: boolean
                           },
"start_inspection":
{ Args: { "p_job": string }; Returns: string
                           },
"try_uuid":
{ Args: { "p": string }; Returns: string
                           },
"update_task_status":
{ Args: { "p_expected_status": Database["public"]['Enums']["task_status"],"p_reason"?: string,"p_status": Database["public"]['Enums']["task_status"],"p_task": string }; Returns: Database["public"]['Enums']["task_status"]
                           },
"void_invoice":
{ Args: { "p_invoice": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "approval_status": "pending"|"approved"|"declined","decision_method": "link"|"in_person"|"phone"|"whatsapp","estimate_item_kind": "labour"|"part"|"other","estimate_item_source": "customer_request"|"recommendation","estimate_status": "draft"|"sent"|"approved"|"partially_approved"|"rejected"|"withdrawn"|"superseded","fuel_level": "empty"|"quarter"|"half"|"three_quarters"|"full","fuel_type": "petrol"|"diesel"|"cng"|"lpg"|"hybrid"|"electric"|"other","inspection_category": "engine"|"transmission"|"brakes"|"suspension"|"steering"|"electrical"|"battery"|"tyres"|"cooling"|"air_conditioning"|"fluids"|"exterior"|"interior","inspection_outcome": "normal"|"needs_attention"|"requires_repair"|"not_inspected","invoice_line_source": "approved_estimate"|"parts_used"|"added","invoice_status": "draft"|"issued"|"void","job_status": "draft"|"awaiting_inspection"|"awaiting_estimate"|"awaiting_approval"|"approved"|"awaiting_assignment"|"in_progress"|"on_hold"|"quality_check"|"ready_for_delivery"|"delivered"|"cancelled","payment_kind": "payment"|"refund","payment_method": "cash"|"bank_transfer"|"card"|"jazzcash"|"easypaisa"|"cheque"|"other","stock_movement_kind": "receipt"|"consumption"|"return"|"adjustment","task_priority": "low"|"normal"|"high"|"urgent","task_status": "pending"|"in_progress"|"blocked"|"completed"|"cancelled","transmission_type": "manual"|"automatic"|"other","workshop_role": "owner"|"advisor"|"mechanic"|"inventory_manager"|"cashier"
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
            "approval_status": ["pending", "approved", "declined"],"decision_method": ["link", "in_person", "phone", "whatsapp"],"estimate_item_kind": ["labour", "part", "other"],"estimate_item_source": ["customer_request", "recommendation"],"estimate_status": ["draft", "sent", "approved", "partially_approved", "rejected", "withdrawn", "superseded"],"fuel_level": ["empty", "quarter", "half", "three_quarters", "full"],"fuel_type": ["petrol", "diesel", "cng", "lpg", "hybrid", "electric", "other"],"inspection_category": ["engine", "transmission", "brakes", "suspension", "steering", "electrical", "battery", "tyres", "cooling", "air_conditioning", "fluids", "exterior", "interior"],"inspection_outcome": ["normal", "needs_attention", "requires_repair", "not_inspected"],"invoice_line_source": ["approved_estimate", "parts_used", "added"],"invoice_status": ["draft", "issued", "void"],"job_status": ["draft", "awaiting_inspection", "awaiting_estimate", "awaiting_approval", "approved", "awaiting_assignment", "in_progress", "on_hold", "quality_check", "ready_for_delivery", "delivered", "cancelled"],"payment_kind": ["payment", "refund"],"payment_method": ["cash", "bank_transfer", "card", "jazzcash", "easypaisa", "cheque", "other"],"stock_movement_kind": ["receipt", "consumption", "return", "adjustment"],"task_priority": ["low", "normal", "high", "urgent"],"task_status": ["pending", "in_progress", "blocked", "completed", "cancelled"],"transmission_type": ["manual", "automatic", "other"],"workshop_role": ["owner", "advisor", "mechanic", "inventory_manager", "cashier"]
          }
        }
} as const
