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
    PostgrestVersion: "16.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bills: {
        Row: {
          archived_at: string | null
          category: Database["public"]["Enums"]["category"]
          created_at: string
          end_date: string | null
          estimated_amount_cents: number | null
          frequency: Database["public"]["Enums"]["bill_frequency"]
          id: string
          name: string
          notes: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          archived_at?: string | null
          category: Database["public"]["Enums"]["category"]
          created_at?: string
          end_date?: string | null
          estimated_amount_cents?: number | null
          frequency: Database["public"]["Enums"]["bill_frequency"]
          id?: string
          name: string
          notes?: string | null
          start_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          category?: Database["public"]["Enums"]["category"]
          created_at?: string
          end_date?: string | null
          estimated_amount_cents?: number | null
          frequency?: Database["public"]["Enums"]["bill_frequency"]
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      third_party_expenses: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          installments: number
          notes: string | null
          person: string
          purchase_date: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          id?: string
          installments?: number
          notes?: string | null
          person: string
          purchase_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          installments?: number
          notes?: string | null
          person?: string
          purchase_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      third_party_settlements: {
        Row: {
          amount_cents: number
          created_at: string
          expense_id: string
          id: string
          installment: number
          settled_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          created_at?: string
          expense_id: string
          id?: string
          installment: number
          settled_at: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          expense_id?: string
          id?: string
          installment?: number
          settled_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "third_party_settlements_expense_id_user_id_fkey"
            columns: ["expense_id", "user_id"]
            referencedRelation: "third_party_expenses"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          bill_id: string | null
          category: Database["public"]["Enums"]["category"]
          created_at: string
          description: string
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount_cents: number
          bill_id?: string | null
          category: Database["public"]["Enums"]["category"]
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount_cents?: number
          bill_id?: string | null
          category?: Database["public"]["Enums"]["category"]
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bill_id_user_id_fkey"
            columns: ["bill_id", "user_id"]
            referencedRelation: "bills"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_and_replace_bill: {
        Args: {
          old_bill_id: string
          p_category: Database["public"]["Enums"]["category"]
          p_end_date?: string
          p_estimated_amount_cents?: number
          p_frequency: Database["public"]["Enums"]["bill_frequency"]
          p_name: string
          p_notes?: string
          p_start_date: string
        }
        Returns: string
      }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      set_allowed_email: { Args: { email: string }; Returns: undefined }
    }
    Enums: {
      bill_frequency: "once" | "weekly" | "monthly" | "yearly"
      category:
        | "housing"
        | "utilities"
        | "internet"
        | "subscriptions"
        | "food"
        | "home"
        | "health"
        | "education"
        | "transportation"
        | "leisure"
        | "shopping"
        | "travel"
        | "taxes"
        | "insurance"
        | "other"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bill_frequency: ["once", "weekly", "monthly", "yearly"],
      category: [
        "housing",
        "utilities",
        "internet",
        "subscriptions",
        "food",
        "home",
        "health",
        "education",
        "transportation",
        "leisure",
        "shopping",
        "travel",
        "taxes",
        "insurance",
        "other",
      ],
    },
  },
} as const
