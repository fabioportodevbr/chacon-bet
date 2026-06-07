export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string
          name: string
          invite_code: string
          used: boolean
          user_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['members']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['members']['Insert']>
      }
      settings: {
        Row: {
          id: number
          pix_key: string
          pix_name: string
          pix_city: string
          bet_value: number
          prize_percent: number
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['settings']['Row']>
        Update: Partial<Database['public']['Tables']['settings']['Row']>
      }
      games: {
        Row: {
          id: string
          phase: string
          group_name: string | null
          game_number: number | null
          home_team: string
          away_team: string
          home_flag: string | null
          away_flag: string | null
          game_date: string | null
          venue: string | null
          home_score: number | null
          away_score: number | null
          status: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['games']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['games']['Insert']>
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          game_id: string
          bettor_name: string | null
          batch_id: string | null
          home_score: number
          away_score: number
          paid: boolean
          paid_at: string | null
          charge_id: string | null
          charge_brcode: string | null
          prize_paid: boolean
          prize_paid_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['predictions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['predictions']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          name: string
          is_admin: boolean
          avatar_url: string | null
          frase: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
    }
  }
}

export type Member = Database['public']['Tables']['members']['Row']
export type Settings = Database['public']['Tables']['settings']['Row']
export type Game = Database['public']['Tables']['games']['Row']
export type Prediction = Database['public']['Tables']['predictions']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
