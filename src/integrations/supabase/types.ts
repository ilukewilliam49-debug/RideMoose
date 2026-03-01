export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      delivery_bids: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          offer_amount_cents: number
          ride_id: string
          status: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          offer_amount_cents: number
          ride_id: string
          status?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          offer_amount_cents?: number
          ride_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_bids_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_bids_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_zones: {
        Row: {
          color: string
          created_at: string
          id: string
          polygon: Json
          zone_key: string
          zone_name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          polygon?: Json
          zone_key: string
          zone_name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          polygon?: Json
          zone_key?: string
          zone_name?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          due_date: string
          id: string
          invoice_number: string | null
          issue_date: string
          organization_id: string
          pdf_url: string | null
          period_end: string
          period_start: string
          ride_count: number
          status: string
          total_cents: number
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          invoice_number?: string | null
          issue_date?: string
          organization_id: string
          pdf_url?: string | null
          period_end: string
          period_start: string
          ride_count?: number
          status?: string
          total_cents?: number
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string
          organization_id?: string
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          ride_count?: number
          status?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          ride_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read?: boolean
          ride_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          ride_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_applications: {
        Row: {
          accounts_payable_email: string | null
          address: string | null
          admin_notes: string | null
          applicant_user_id: string
          billing_email: string
          company_name: string
          contact_person_email: string
          contact_person_name: string
          created_at: string
          estimated_monthly_spend_cents: number
          id: string
          payment_terms_requested: number
          phone: string | null
          registration_number: string | null
          requested_credit_limit_cents: number
          status: string
          updated_at: string
        }
        Insert: {
          accounts_payable_email?: string | null
          address?: string | null
          admin_notes?: string | null
          applicant_user_id: string
          billing_email: string
          company_name: string
          contact_person_email: string
          contact_person_name: string
          created_at?: string
          estimated_monthly_spend_cents?: number
          id?: string
          payment_terms_requested?: number
          phone?: string | null
          registration_number?: string | null
          requested_credit_limit_cents?: number
          status?: string
          updated_at?: string
        }
        Update: {
          accounts_payable_email?: string | null
          address?: string | null
          admin_notes?: string | null
          applicant_user_id?: string
          billing_email?: string
          company_name?: string
          contact_person_email?: string
          contact_person_name?: string
          created_at?: string
          estimated_monthly_spend_cents?: number
          id?: string
          payment_terms_requested?: number
          phone?: string | null
          registration_number?: string | null
          requested_credit_limit_cents?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          accounts_payable_email: string | null
          billing_email: string
          created_at: string
          credit_limit_cents: number
          current_balance_cents: number
          id: string
          name: string
          payment_terms_days: number
          status: string
        }
        Insert: {
          accounts_payable_email?: string | null
          billing_email: string
          created_at?: string
          credit_limit_cents?: number
          current_balance_cents?: number
          id?: string
          name: string
          payment_terms_days?: number
          status?: string
        }
        Update: {
          accounts_payable_email?: string | null
          billing_email?: string
          created_at?: string
          credit_limit_cents?: number
          current_balance_cents?: number
          id?: string
          name?: string
          payment_terms_days?: number
          status?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          id: string
          key: string
          label: string
          updated_at: string
          value: number
        }
        Insert: {
          id?: string
          key: string
          label?: string
          updated_at?: string
          value?: number
        }
        Update: {
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          base_fare: number
          created_at: string
          id: string
          is_active: boolean
          minimum_fare: number
          per_km_rate: number
          per_min_rate: number
          surge_multiplier: number
          surge_threshold_pending: number
          updated_at: string
        }
        Insert: {
          base_fare?: number
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_fare?: number
          per_km_rate?: number
          per_min_rate?: number
          surge_multiplier?: number
          surge_threshold_pending?: number
          updated_at?: string
        }
        Update: {
          base_fare?: number
          created_at?: string
          id?: string
          is_active?: boolean
          minimum_fare?: number
          per_km_rate?: number
          per_min_rate?: number
          surge_multiplier?: number
          surge_threshold_pending?: number
          updated_at?: string
        }
        Relationships: []
      }
      private_hire_zones: {
        Row: {
          active: boolean
          created_at: string
          dropoff_zone: string
          flat_fare_cents: number
          id: string
          pickup_zone: string
          zone_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dropoff_zone: string
          flat_fare_cents: number
          id?: string
          pickup_zone: string
          zone_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dropoff_zone?: string
          flat_fare_cents?: number
          id?: string
          pickup_zone?: string
          zone_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_courier: boolean
          can_private_hire: boolean
          can_shuttle: boolean
          can_taxi: boolean
          commission_rate: number
          created_at: string
          driver_balance_cents: number
          full_name: string
          id: string
          is_available: boolean | null
          latitude: number | null
          launch_start_date: string | null
          longitude: number | null
          organization_id: string | null
          phone: string | null
          promo_commission_rate: number
          promo_end_date: string | null
          role: Database["public"]["Enums"]["user_role"]
          role_in_org: string | null
          seat_capacity: number | null
          standard_commission_rate: number
          updated_at: string
          user_id: string
          vehicle_type: string | null
        }
        Insert: {
          avatar_url?: string | null
          can_courier?: boolean
          can_private_hire?: boolean
          can_shuttle?: boolean
          can_taxi?: boolean
          commission_rate?: number
          created_at?: string
          driver_balance_cents?: number
          full_name?: string
          id?: string
          is_available?: boolean | null
          latitude?: number | null
          launch_start_date?: string | null
          longitude?: number | null
          organization_id?: string | null
          phone?: string | null
          promo_commission_rate?: number
          promo_end_date?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_in_org?: string | null
          seat_capacity?: number | null
          standard_commission_rate?: number
          updated_at?: string
          user_id: string
          vehicle_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          can_courier?: boolean
          can_private_hire?: boolean
          can_shuttle?: boolean
          can_taxi?: boolean
          commission_rate?: number
          created_at?: string
          driver_balance_cents?: number
          full_name?: string
          id?: string
          is_available?: boolean | null
          latitude?: number | null
          launch_start_date?: string | null
          longitude?: number | null
          organization_id?: string | null
          phone?: string | null
          promo_commission_rate?: number
          promo_end_date?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_in_org?: string | null
          seat_capacity?: number | null
          standard_commission_rate?: number
          updated_at?: string
          user_id?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rated_by: string
          rated_user: string
          rating: number
          ride_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_by: string
          rated_user: string
          rating: number
          ride_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_by?: string
          rated_user?: string
          rating?: number
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_ratings_rated_by_fkey"
            columns: ["rated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_ratings_rated_user_fkey"
            columns: ["rated_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          authorized_amount_cents: number | null
          bidding_ends_at: string | null
          billed_to: string
          captured_amount_cents: number | null
          commission_cents: number
          completed_at: string | null
          cost_center: string | null
          created_at: string
          distance_km: number | null
          driver_collected_outstanding_at: string | null
          driver_earnings_cents: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_notes: string | null
          duration_min: number
          estimated_price: number | null
          final_fare_cents: number | null
          final_price: number | null
          id: string
          invoice_id: string | null
          invoiced: boolean
          item_description: string | null
          marketplace_delivery: boolean
          meter_ended_at: string | null
          meter_started_at: string | null
          meter_status: string
          order_value_cents: number | null
          organization_id: string | null
          outstanding_amount_cents: number | null
          outstanding_reason: string | null
          overage_cents: number | null
          overage_client_secret: string | null
          package_size: string | null
          paid_at: string | null
          passenger_count: number
          payment_option: string
          payment_status: string
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_notes: string | null
          po_number: string | null
          price_increase_count: number
          pricing_model: string
          proof_photo_required: boolean
          proof_photo_url: string | null
          requires_loading_help: boolean
          rider_id: string
          scheduled_at: string | null
          service_fee_cents: number
          service_type: Database["public"]["Enums"]["service_type"]
          signature_required: boolean
          stairs_involved: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          store_id: string | null
          stripe_fee_cents: number
          stripe_payment_intent_id: string | null
          updated_at: string
          waiting_min: number
          weight_estimate_kg: number | null
        }
        Insert: {
          authorized_amount_cents?: number | null
          bidding_ends_at?: string | null
          billed_to?: string
          captured_amount_cents?: number | null
          commission_cents?: number
          completed_at?: string | null
          cost_center?: string | null
          created_at?: string
          distance_km?: number | null
          driver_collected_outstanding_at?: string | null
          driver_earnings_cents?: number
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_notes?: string | null
          duration_min?: number
          estimated_price?: number | null
          final_fare_cents?: number | null
          final_price?: number | null
          id?: string
          invoice_id?: string | null
          invoiced?: boolean
          item_description?: string | null
          marketplace_delivery?: boolean
          meter_ended_at?: string | null
          meter_started_at?: string | null
          meter_status?: string
          order_value_cents?: number | null
          organization_id?: string | null
          outstanding_amount_cents?: number | null
          outstanding_reason?: string | null
          overage_cents?: number | null
          overage_client_secret?: string | null
          package_size?: string | null
          paid_at?: string | null
          passenger_count?: number
          payment_option?: string
          payment_status?: string
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_notes?: string | null
          po_number?: string | null
          price_increase_count?: number
          pricing_model?: string
          proof_photo_required?: boolean
          proof_photo_url?: string | null
          requires_loading_help?: boolean
          rider_id: string
          scheduled_at?: string | null
          service_fee_cents?: number
          service_type?: Database["public"]["Enums"]["service_type"]
          signature_required?: boolean
          stairs_involved?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          store_id?: string | null
          stripe_fee_cents?: number
          stripe_payment_intent_id?: string | null
          updated_at?: string
          waiting_min?: number
          weight_estimate_kg?: number | null
        }
        Update: {
          authorized_amount_cents?: number | null
          bidding_ends_at?: string | null
          billed_to?: string
          captured_amount_cents?: number | null
          commission_cents?: number
          completed_at?: string | null
          cost_center?: string | null
          created_at?: string
          distance_km?: number | null
          driver_collected_outstanding_at?: string | null
          driver_earnings_cents?: number
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_notes?: string | null
          duration_min?: number
          estimated_price?: number | null
          final_fare_cents?: number | null
          final_price?: number | null
          id?: string
          invoice_id?: string | null
          invoiced?: boolean
          item_description?: string | null
          marketplace_delivery?: boolean
          meter_ended_at?: string | null
          meter_started_at?: string | null
          meter_status?: string
          order_value_cents?: number | null
          organization_id?: string | null
          outstanding_amount_cents?: number | null
          outstanding_reason?: string | null
          overage_cents?: number | null
          overage_client_secret?: string | null
          package_size?: string | null
          paid_at?: string | null
          passenger_count?: number
          payment_option?: string
          payment_status?: string
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_notes?: string | null
          po_number?: string | null
          price_increase_count?: number
          pricing_model?: string
          proof_photo_required?: boolean
          proof_photo_url?: string | null
          requires_loading_help?: boolean
          rider_id?: string
          scheduled_at?: string | null
          service_fee_cents?: number
          service_type?: Database["public"]["Enums"]["service_type"]
          signature_required?: boolean
          stairs_involved?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          store_id?: string | null
          stripe_fee_cents?: number
          stripe_payment_intent_id?: string | null
          updated_at?: string
          waiting_min?: number
          weight_estimate_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_pricing: {
        Row: {
          base_fare: number
          created_at: string
          flat_rate: number | null
          id: string
          is_active: boolean
          is_flat_rate: boolean
          minimum_fare: number
          per_km_rate: number
          per_min_rate: number
          per_seat_rate: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          surge_multiplier: number
          updated_at: string
        }
        Insert: {
          base_fare?: number
          created_at?: string
          flat_rate?: number | null
          id?: string
          is_active?: boolean
          is_flat_rate?: boolean
          minimum_fare?: number
          per_km_rate?: number
          per_min_rate?: number
          per_seat_rate?: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          surge_multiplier?: number
          updated_at?: string
        }
        Update: {
          base_fare?: number
          created_at?: string
          flat_rate?: number | null
          id?: string
          is_active?: boolean
          is_flat_rate?: boolean
          minimum_fare?: number
          per_km_rate?: number
          per_min_rate?: number
          per_seat_rate?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          surge_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          messages: Json
          resolved_at: string | null
          ride_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          messages?: Json
          resolved_at?: string | null
          ride_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          messages?: Json
          resolved_at?: string | null
          ride_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      taxi_rates: {
        Row: {
          active: boolean
          base_fare_cents: number
          created_at: string
          free_waiting_min: number
          id: string
          per_km_cents: number
          waiting_per_min_cents: number
        }
        Insert: {
          active?: boolean
          base_fare_cents?: number
          created_at?: string
          free_waiting_min?: number
          id?: string
          per_km_cents?: number
          waiting_per_min_cents?: number
        }
        Update: {
          active?: boolean
          base_fare_cents?: number
          created_at?: string
          free_waiting_min?: number
          id?: string
          per_km_cents?: number
          waiting_per_min_cents?: number
        }
        Relationships: []
      }
      verifications: {
        Row: {
          created_at: string
          document_type: string
          document_url: string
          driver_id: string
          id: string
          reviewed_by: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          document_url: string
          driver_id: string
          id?: string
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          document_url?: string
          driver_id?: string
          id?: string
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      driver_can_serve: {
        Args: {
          _service: Database["public"]["Enums"]["service_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ride_status:
        | "requested"
        | "dispatched"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      service_type:
        | "taxi"
        | "shuttle"
        | "private_hire"
        | "courier"
        | "large_delivery"
        | "retail_delivery"
      user_role: "rider" | "driver" | "admin"
      verification_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ride_status: [
        "requested",
        "dispatched",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      service_type: [
        "taxi",
        "shuttle",
        "private_hire",
        "courier",
        "large_delivery",
        "retail_delivery",
      ],
      user_role: ["rider", "driver", "admin"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
