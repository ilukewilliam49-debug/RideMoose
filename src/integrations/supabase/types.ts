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
      organizations: {
        Row: {
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
          can_private_hire: boolean
          can_shuttle: boolean
          can_taxi: boolean
          created_at: string
          full_name: string
          id: string
          is_available: boolean | null
          latitude: number | null
          longitude: number | null
          organization_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          role_in_org: string | null
          seat_capacity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          can_private_hire?: boolean
          can_shuttle?: boolean
          can_taxi?: boolean
          created_at?: string
          full_name?: string
          id?: string
          is_available?: boolean | null
          latitude?: number | null
          longitude?: number | null
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_in_org?: string | null
          seat_capacity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          can_private_hire?: boolean
          can_shuttle?: boolean
          can_taxi?: boolean
          created_at?: string
          full_name?: string
          id?: string
          is_available?: boolean | null
          latitude?: number | null
          longitude?: number | null
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_in_org?: string | null
          seat_capacity?: number | null
          updated_at?: string
          user_id?: string
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
          billed_to: string
          captured_amount_cents: number | null
          completed_at: string | null
          created_at: string
          distance_km: number | null
          driver_collected_outstanding_at: string | null
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number | null
          dropoff_lng: number | null
          duration_min: number
          estimated_price: number | null
          final_fare_cents: number | null
          final_price: number | null
          id: string
          invoiced: boolean
          meter_ended_at: string | null
          meter_started_at: string | null
          meter_status: string
          organization_id: string | null
          outstanding_amount_cents: number | null
          outstanding_reason: string | null
          overage_cents: number | null
          overage_client_secret: string | null
          paid_at: string | null
          passenger_count: number
          payment_option: string
          payment_status: string
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          pricing_model: string
          rider_id: string
          scheduled_at: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          stripe_payment_intent_id: string | null
          updated_at: string
          waiting_min: number
        }
        Insert: {
          authorized_amount_cents?: number | null
          billed_to?: string
          captured_amount_cents?: number | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          driver_collected_outstanding_at?: string | null
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          duration_min?: number
          estimated_price?: number | null
          final_fare_cents?: number | null
          final_price?: number | null
          id?: string
          invoiced?: boolean
          meter_ended_at?: string | null
          meter_started_at?: string | null
          meter_status?: string
          organization_id?: string | null
          outstanding_amount_cents?: number | null
          outstanding_reason?: string | null
          overage_cents?: number | null
          overage_client_secret?: string | null
          paid_at?: string | null
          passenger_count?: number
          payment_option?: string
          payment_status?: string
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pricing_model?: string
          rider_id: string
          scheduled_at?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
          waiting_min?: number
        }
        Update: {
          authorized_amount_cents?: number | null
          billed_to?: string
          captured_amount_cents?: number | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          driver_collected_outstanding_at?: string | null
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          duration_min?: number
          estimated_price?: number | null
          final_fare_cents?: number | null
          final_price?: number | null
          id?: string
          invoiced?: boolean
          meter_ended_at?: string | null
          meter_started_at?: string | null
          meter_status?: string
          organization_id?: string | null
          outstanding_amount_cents?: number | null
          outstanding_reason?: string | null
          overage_cents?: number | null
          overage_client_secret?: string | null
          paid_at?: string | null
          passenger_count?: number
          payment_option?: string
          payment_status?: string
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pricing_model?: string
          rider_id?: string
          scheduled_at?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
          waiting_min?: number
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
      service_type: "taxi" | "shuttle" | "private_hire"
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
      service_type: ["taxi", "shuttle", "private_hire"],
      user_role: ["rider", "driver", "admin"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
