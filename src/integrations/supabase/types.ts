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
      admin_audit_log: {
        Row: {
          action: string
          admin_profile_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_profile_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_profile_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_profile_id_fkey"
            columns: ["admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
            referencedRelation: "driver_rides"
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
      driver_shift_events: {
        Row: {
          created_at: string
          driver_id: string
          event_type: string
          id: string
          metadata: Json
          shift_duration_minutes: number | null
          shift_session_id: string | null
          shift_started_at: string | null
          source: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          event_type: string
          id?: string
          metadata?: Json
          shift_duration_minutes?: number | null
          shift_session_id?: string | null
          shift_started_at?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          shift_duration_minutes?: number | null
          shift_session_id?: string | null
          shift_started_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_shift_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_shift_events_shift_session_id_fkey"
            columns: ["shift_session_id"]
            isOneToOne: false
            referencedRelation: "shift_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
      notification_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          event: string
          id: string
          metadata: Json | null
          method: string
          onesignal_id: string | null
          recipients: number | null
          retry_count: number
          ride_id: string | null
          status: string
          target_profile_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event: string
          id?: string
          metadata?: Json | null
          method?: string
          onesignal_id?: string | null
          recipients?: number | null
          retry_count?: number
          ride_id?: string | null
          status?: string
          target_profile_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event?: string
          id?: string
          metadata?: Json | null
          method?: string
          onesignal_id?: string | null
          recipients?: number | null
          retry_count?: number
          ride_id?: string | null
          status?: string
          target_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "driver_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rate_limits: {
        Row: {
          id: string
          key: string
          request_count: number
          window_start: string
        }
        Insert: {
          id?: string
          key: string
          request_count?: number
          window_start?: string
        }
        Update: {
          id?: string
          key?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
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
            referencedRelation: "driver_rides"
            referencedColumns: ["id"]
          },
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
      password_reset_attempts: {
        Row: {
          attempt_count: number
          created_at: string
          email: string
          id: string
          last_attempt_at: string
          reset_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          email: string
          id?: string
          last_attempt_at?: string
          reset_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          email?: string
          id?: string
          last_attempt_at?: string
          reset_at?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount_cents: number
          created_at: string
          driver_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          driver_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          driver_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          phone: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          phone: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          phone?: string
          user_id?: string
          verified?: boolean
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
          average_rating: number | null
          business_onboarding_complete: boolean
          can_courier: boolean
          can_private_hire: boolean
          can_shuttle: boolean
          can_taxi: boolean
          commission_rate: number
          created_at: string
          driver_balance_cents: number
          driver_onboarding_complete: boolean
          full_name: string
          id: string
          is_available: boolean | null
          is_business: boolean
          is_driver: boolean
          is_rider: boolean
          last_seen_at: string | null
          last_used_role: string | null
          latitude: number | null
          launch_start_date: string | null
          license_plate: string | null
          longitude: number | null
          onesignal_player_id: string | null
          organization_id: string | null
          phone: string | null
          phone_verified: boolean
          promo_commission_rate: number
          promo_end_date: string | null
          rider_average_rating: number | null
          rider_onboarding_complete: boolean
          rider_total_ratings: number | null
          role_in_org: string | null
          seat_capacity: number | null
          sms_notifications_enabled: boolean
          standard_commission_rate: number
          total_ratings: number | null
          updated_at: string
          user_id: string
          vehicle_color: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: number | null
          went_online_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          average_rating?: number | null
          business_onboarding_complete?: boolean
          can_courier?: boolean
          can_private_hire?: boolean
          can_shuttle?: boolean
          can_taxi?: boolean
          commission_rate?: number
          created_at?: string
          driver_balance_cents?: number
          driver_onboarding_complete?: boolean
          full_name?: string
          id?: string
          is_available?: boolean | null
          is_business?: boolean
          is_driver?: boolean
          is_rider?: boolean
          last_seen_at?: string | null
          last_used_role?: string | null
          latitude?: number | null
          launch_start_date?: string | null
          license_plate?: string | null
          longitude?: number | null
          onesignal_player_id?: string | null
          organization_id?: string | null
          phone?: string | null
          phone_verified?: boolean
          promo_commission_rate?: number
          promo_end_date?: string | null
          rider_average_rating?: number | null
          rider_onboarding_complete?: boolean
          rider_total_ratings?: number | null
          role_in_org?: string | null
          seat_capacity?: number | null
          sms_notifications_enabled?: boolean
          standard_commission_rate?: number
          total_ratings?: number | null
          updated_at?: string
          user_id: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
          went_online_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          average_rating?: number | null
          business_onboarding_complete?: boolean
          can_courier?: boolean
          can_private_hire?: boolean
          can_shuttle?: boolean
          can_taxi?: boolean
          commission_rate?: number
          created_at?: string
          driver_balance_cents?: number
          driver_onboarding_complete?: boolean
          full_name?: string
          id?: string
          is_available?: boolean | null
          is_business?: boolean
          is_driver?: boolean
          is_rider?: boolean
          last_seen_at?: string | null
          last_used_role?: string | null
          latitude?: number | null
          launch_start_date?: string | null
          license_plate?: string | null
          longitude?: number | null
          onesignal_player_id?: string | null
          organization_id?: string | null
          phone?: string | null
          phone_verified?: boolean
          promo_commission_rate?: number
          promo_end_date?: string | null
          rider_average_rating?: number | null
          rider_onboarding_complete?: boolean
          rider_total_ratings?: number | null
          role_in_org?: string | null
          seat_capacity?: number | null
          sms_notifications_enabled?: boolean
          standard_commission_rate?: number
          total_ratings?: number | null
          updated_at?: string
          user_id?: string
          vehicle_color?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
          went_online_at?: string | null
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
      ride_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          ride_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          ride_id: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_events_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "driver_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_events_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ride_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_message_reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_messages: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          image_url: string | null
          location_lat: number | null
          location_lng: number | null
          message: string
          read_at: string | null
          ride_id: string
          sender_profile_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message: string
          read_at?: string | null
          ride_id: string
          sender_profile_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          message?: string
          read_at?: string | null
          ride_id?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "driver_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
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
          feedback_tags: string[] | null
          id: string
          rated_by: string
          rated_user: string
          rating: number
          ride_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_tags?: string[] | null
          id?: string
          rated_by: string
          rated_user: string
          rating: number
          ride_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_tags?: string[] | null
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
            referencedRelation: "driver_rides"
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
          accessibility_required: boolean
          authorized_amount_cents: number | null
          bidding_ends_at: string | null
          billed_to: string
          booking_for: string
          cancellation_fee_cents: number
          cancellation_reason: string | null
          captured_amount_cents: number | null
          commission_cents: number
          completed_at: string | null
          cost_center: string | null
          created_at: string
          delivery_fee_cents: number | null
          dispatch_expires_at: string | null
          dispatched_to_driver_id: string | null
          distance_km: number | null
          driver_collected_outstanding_at: string | null
          driver_earnings_cents: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_notes: string | null
          duration_min: number
          estimated_item_cost_cents: number | null
          estimated_price: number | null
          final_fare_cents: number | null
          final_item_cost_cents: number | null
          final_price: number | null
          guest_name: string | null
          guest_phone: string | null
          guest_track_token: string | null
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
          pickup_delivery_no_passenger: boolean
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_notes: string | null
          pickyou_surcharge_cents: number
          po_number: string | null
          price_increase_count: number
          pricing_model: string
          proof_photo_required: boolean
          proof_photo_url: string | null
          quantity: number | null
          receipt_photo_url: string | null
          requires_loading_help: boolean
          restaurant_id: string | null
          rider_id: string
          scheduled_at: string | null
          service_fee_cents: number
          service_type: Database["public"]["Enums"]["service_type"]
          shopper_fee_cents: number | null
          signature_required: boolean
          stairs_involved: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          stops: Json
          store_id: string | null
          store_name: string | null
          stripe_fee_cents: number
          stripe_payment_intent_id: string | null
          tax_cents: number
          tip_cents: number
          updated_at: string
          waiting_min: number
          weight_estimate_kg: number | null
        }
        Insert: {
          accessibility_required?: boolean
          authorized_amount_cents?: number | null
          bidding_ends_at?: string | null
          billed_to?: string
          booking_for?: string
          cancellation_fee_cents?: number
          cancellation_reason?: string | null
          captured_amount_cents?: number | null
          commission_cents?: number
          completed_at?: string | null
          cost_center?: string | null
          created_at?: string
          delivery_fee_cents?: number | null
          dispatch_expires_at?: string | null
          dispatched_to_driver_id?: string | null
          distance_km?: number | null
          driver_collected_outstanding_at?: string | null
          driver_earnings_cents?: number
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_notes?: string | null
          duration_min?: number
          estimated_item_cost_cents?: number | null
          estimated_price?: number | null
          final_fare_cents?: number | null
          final_item_cost_cents?: number | null
          final_price?: number | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_track_token?: string | null
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
          pickup_delivery_no_passenger?: boolean
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_notes?: string | null
          pickyou_surcharge_cents?: number
          po_number?: string | null
          price_increase_count?: number
          pricing_model?: string
          proof_photo_required?: boolean
          proof_photo_url?: string | null
          quantity?: number | null
          receipt_photo_url?: string | null
          requires_loading_help?: boolean
          restaurant_id?: string | null
          rider_id: string
          scheduled_at?: string | null
          service_fee_cents?: number
          service_type?: Database["public"]["Enums"]["service_type"]
          shopper_fee_cents?: number | null
          signature_required?: boolean
          stairs_involved?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          stops?: Json
          store_id?: string | null
          store_name?: string | null
          stripe_fee_cents?: number
          stripe_payment_intent_id?: string | null
          tax_cents?: number
          tip_cents?: number
          updated_at?: string
          waiting_min?: number
          weight_estimate_kg?: number | null
        }
        Update: {
          accessibility_required?: boolean
          authorized_amount_cents?: number | null
          bidding_ends_at?: string | null
          billed_to?: string
          booking_for?: string
          cancellation_fee_cents?: number
          cancellation_reason?: string | null
          captured_amount_cents?: number | null
          commission_cents?: number
          completed_at?: string | null
          cost_center?: string | null
          created_at?: string
          delivery_fee_cents?: number | null
          dispatch_expires_at?: string | null
          dispatched_to_driver_id?: string | null
          distance_km?: number | null
          driver_collected_outstanding_at?: string | null
          driver_earnings_cents?: number
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_notes?: string | null
          duration_min?: number
          estimated_item_cost_cents?: number | null
          estimated_price?: number | null
          final_fare_cents?: number | null
          final_item_cost_cents?: number | null
          final_price?: number | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_track_token?: string | null
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
          pickup_delivery_no_passenger?: boolean
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_notes?: string | null
          pickyou_surcharge_cents?: number
          po_number?: string | null
          price_increase_count?: number
          pricing_model?: string
          proof_photo_required?: boolean
          proof_photo_url?: string | null
          quantity?: number | null
          receipt_photo_url?: string | null
          requires_loading_help?: boolean
          restaurant_id?: string | null
          rider_id?: string
          scheduled_at?: string | null
          service_fee_cents?: number
          service_type?: Database["public"]["Enums"]["service_type"]
          shopper_fee_cents?: number | null
          signature_required?: boolean
          stairs_involved?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          stops?: Json
          store_id?: string | null
          store_name?: string | null
          stripe_fee_cents?: number
          stripe_payment_intent_id?: string | null
          tax_cents?: number
          tip_cents?: number
          updated_at?: string
          waiting_min?: number
          weight_estimate_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_dispatched_to_driver_id_fkey"
            columns: ["dispatched_to_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      saved_places: {
        Row: {
          address: string
          created_at: string
          icon: string
          id: string
          label: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          created_at?: string
          icon?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          icon?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      shift_sessions: {
        Row: {
          created_at: string
          driver_id: string
          ended_at: string | null
          id: string
          started_at: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_sessions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "driver_rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_conversations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      taxi_rates: {
        Row: {
          active: boolean
          base_fare_cents: number
          created_at: string
          free_waiting_min: number
          id: string
          included_meters: number
          increment_meters: number
          large_vehicle_surcharge_cents: number
          per_increment_cents: number
          per_km_cents: number
          pickup_delivery_surcharge_cents: number
          pickyou_gst_rate: number
          pickyou_platform_fee_cents: number
          waiting_per_min_cents: number
        }
        Insert: {
          active?: boolean
          base_fare_cents?: number
          created_at?: string
          free_waiting_min?: number
          id?: string
          included_meters?: number
          increment_meters?: number
          large_vehicle_surcharge_cents?: number
          per_increment_cents?: number
          per_km_cents?: number
          pickup_delivery_surcharge_cents?: number
          pickyou_gst_rate?: number
          pickyou_platform_fee_cents?: number
          waiting_per_min_cents?: number
        }
        Update: {
          active?: boolean
          base_fare_cents?: number
          created_at?: string
          free_waiting_min?: number
          id?: string
          included_meters?: number
          increment_meters?: number
          large_vehicle_surcharge_cents?: number
          per_increment_cents?: number
          per_km_cents?: number
          pickup_delivery_surcharge_cents?: number
          pickyou_gst_rate?: number
          pickyou_platform_fee_cents?: number
          waiting_per_min_cents?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      driver_rides: {
        Row: {
          bidding_ends_at: string | null
          billed_to: string | null
          cancellation_fee_cents: number | null
          cancellation_reason: string | null
          commission_cents: number | null
          completed_at: string | null
          cost_center: string | null
          created_at: string | null
          delivery_fee_cents: number | null
          dispatch_expires_at: string | null
          dispatched_to_driver_id: string | null
          distance_km: number | null
          driver_earnings_cents: number | null
          driver_id: string | null
          dropoff_address: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_notes: string | null
          duration_min: number | null
          estimated_item_cost_cents: number | null
          estimated_price: number | null
          final_fare_cents: number | null
          final_item_cost_cents: number | null
          final_price: number | null
          id: string | null
          invoice_id: string | null
          invoiced: boolean | null
          item_description: string | null
          marketplace_delivery: boolean | null
          meter_ended_at: string | null
          meter_started_at: string | null
          meter_status: string | null
          order_value_cents: number | null
          organization_id: string | null
          package_size: string | null
          passenger_count: number | null
          payment_option: string | null
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_notes: string | null
          po_number: string | null
          price_increase_count: number | null
          pricing_model: string | null
          proof_photo_required: boolean | null
          proof_photo_url: string | null
          quantity: number | null
          receipt_photo_url: string | null
          requires_loading_help: boolean | null
          rider_id: string | null
          scheduled_at: string | null
          service_fee_cents: number | null
          service_type: Database["public"]["Enums"]["service_type"] | null
          shopper_fee_cents: number | null
          signature_required: boolean | null
          stairs_involved: boolean | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"] | null
          store_id: string | null
          store_name: string | null
          tax_cents: number | null
          tip_cents: number | null
          updated_at: string | null
          waiting_min: number | null
          weight_estimate_kg: number | null
        }
        Insert: {
          bidding_ends_at?: string | null
          billed_to?: string | null
          cancellation_fee_cents?: number | null
          cancellation_reason?: string | null
          commission_cents?: number | null
          completed_at?: string | null
          cost_center?: string | null
          created_at?: string | null
          delivery_fee_cents?: number | null
          dispatch_expires_at?: string | null
          dispatched_to_driver_id?: string | null
          distance_km?: number | null
          driver_earnings_cents?: number | null
          driver_id?: string | null
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_notes?: string | null
          duration_min?: number | null
          estimated_item_cost_cents?: number | null
          estimated_price?: number | null
          final_fare_cents?: number | null
          final_item_cost_cents?: number | null
          final_price?: number | null
          id?: string | null
          invoice_id?: string | null
          invoiced?: boolean | null
          item_description?: string | null
          marketplace_delivery?: boolean | null
          meter_ended_at?: string | null
          meter_started_at?: string | null
          meter_status?: string | null
          order_value_cents?: number | null
          organization_id?: string | null
          package_size?: string | null
          passenger_count?: number | null
          payment_option?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_notes?: string | null
          po_number?: string | null
          price_increase_count?: number | null
          pricing_model?: string | null
          proof_photo_required?: boolean | null
          proof_photo_url?: string | null
          quantity?: number | null
          receipt_photo_url?: string | null
          requires_loading_help?: boolean | null
          rider_id?: string | null
          scheduled_at?: string | null
          service_fee_cents?: number | null
          service_type?: Database["public"]["Enums"]["service_type"] | null
          shopper_fee_cents?: number | null
          signature_required?: boolean | null
          stairs_involved?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"] | null
          store_id?: string | null
          store_name?: string | null
          tax_cents?: number | null
          tip_cents?: number | null
          updated_at?: string | null
          waiting_min?: number | null
          weight_estimate_kg?: number | null
        }
        Update: {
          bidding_ends_at?: string | null
          billed_to?: string | null
          cancellation_fee_cents?: number | null
          cancellation_reason?: string | null
          commission_cents?: number | null
          completed_at?: string | null
          cost_center?: string | null
          created_at?: string | null
          delivery_fee_cents?: number | null
          dispatch_expires_at?: string | null
          dispatched_to_driver_id?: string | null
          distance_km?: number | null
          driver_earnings_cents?: number | null
          driver_id?: string | null
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_notes?: string | null
          duration_min?: number | null
          estimated_item_cost_cents?: number | null
          estimated_price?: number | null
          final_fare_cents?: number | null
          final_item_cost_cents?: number | null
          final_price?: number | null
          id?: string | null
          invoice_id?: string | null
          invoiced?: boolean | null
          item_description?: string | null
          marketplace_delivery?: boolean | null
          meter_ended_at?: string | null
          meter_started_at?: string | null
          meter_status?: string | null
          order_value_cents?: number | null
          organization_id?: string | null
          package_size?: string | null
          passenger_count?: number | null
          payment_option?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_notes?: string | null
          po_number?: string | null
          price_increase_count?: number | null
          pricing_model?: string | null
          proof_photo_required?: boolean | null
          proof_photo_url?: string | null
          quantity?: number | null
          receipt_photo_url?: string | null
          requires_loading_help?: boolean | null
          rider_id?: string | null
          scheduled_at?: string | null
          service_fee_cents?: number | null
          service_type?: Database["public"]["Enums"]["service_type"] | null
          shopper_fee_cents?: number | null
          signature_required?: boolean | null
          stairs_involved?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"] | null
          store_id?: string | null
          store_name?: string | null
          tax_cents?: number | null
          tip_cents?: number | null
          updated_at?: string | null
          waiting_min?: number | null
          weight_estimate_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_dispatched_to_driver_id_fkey"
            columns: ["dispatched_to_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
    }
    Functions: {
      _test_cleanup_lifecycle_ride: {
        Args: { _ride_id: string }
        Returns: undefined
      }
      _test_seed_lifecycle_ride: {
        Args: {
          _driver_id: string
          _service_type: Database["public"]["Enums"]["service_type"]
          _status: Database["public"]["Enums"]["ride_status"]
        }
        Returns: string
      }
      accept_ride: {
        Args: { _driver_profile_id: string; _ride_id: string }
        Returns: Json
      }
      authorize_realtime_channel: {
        Args: { _channel: string; _user_id: string }
        Returns: boolean
      }
      auto_offline_overdue_shifts: { Args: never; Returns: number }
      auto_offline_stale_drivers: { Args: never; Returns: number }
      check_notification_rate_limit: {
        Args: { _key: string; _max_requests?: number; _window_seconds?: number }
        Returns: boolean
      }
      check_password_reset_rate_limit: {
        Args: { user_email: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      driver_can_serve: {
        Args: {
          _service: Database["public"]["Enums"]["service_type"]
          _user_id: string
        }
        Returns: boolean
      }
      driver_shift_within_limit: {
        Args: { _driver_profile_id: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_ride_track_token: { Args: { _ride_id: string }; Returns: string }
      get_ride_stats: {
        Args: {
          _date_from?: string
          _date_to?: string
          _service_type?: string
          _status?: string
        }
        Returns: Json
      }
      get_total_revenue: { Args: never; Returns: number }
      has_app_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_driver_live: { Args: { _profile_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      provision_capability: { Args: { _intent: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      touch_driver_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      ride_status:
        | "requested"
        | "dispatched"
        | "accepted"
        | "arrived"
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
        | "personal_shopper"
        | "food_delivery"
        | "pet_transport"
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
      app_role: ["admin", "moderator", "user"],
      ride_status: [
        "requested",
        "dispatched",
        "accepted",
        "arrived",
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
        "personal_shopper",
        "food_delivery",
        "pet_transport",
      ],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
