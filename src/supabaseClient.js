import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://vgvchsjarhyghficuwzc.supabase.co'
const supabaseAnonKey = 'sb_publishable_mZeJjXbia0b1UJ7ceRfefw_vJhSdNJf'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
