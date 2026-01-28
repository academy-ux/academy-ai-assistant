#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as readline from 'readline'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('✅ Connected to Supabase!')
console.log(`📍 URL: ${supabaseUrl}`)
console.log('\n🔧 Available commands:')
console.log('  list              - List all meetings')
console.log('  count             - Count meetings')
console.log('  count-by-type     - Count meetings by type')
console.log('  search <query>    - Search meetings')
console.log('  delete <id>       - Delete a meeting by ID')
console.log('  clear-all         - Delete all meetings')
console.log('  sql <query>       - Run raw SQL (use single quotes)')
console.log('  exit              - Exit CLI\n')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'supabase> '
})

rl.prompt()

rl.on('line', async (line) => {
  const input = line.trim()
  const [command, ...args] = input.split(' ')

  try {
    switch (command) {
      case 'list': {
        const { data, error } = await supabase
          .from('interviews')
          .select('id, candidate_name, meeting_type, meeting_title, created_at')
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (error) throw error
        console.table(data)
        console.log(`\n📊 Showing ${data?.length || 0} most recent meetings`)
        break
      }

      case 'count': {
        const { count, error } = await supabase
          .from('interviews')
          .select('*', { count: 'exact', head: true })
        
        if (error) throw error
        console.log(`📊 Total meetings: ${count}`)
        break
      }

      case 'count-by-type': {
        const { data, error } = await supabase
          .from('interviews')
          .select('meeting_type')
        
        if (error) throw error
        
        const counts = data?.reduce((acc: any, row: any) => {
          const type = row.meeting_type || 'Unknown'
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {})
        
        console.log('📊 Meetings by type:')
        Object.entries(counts || {}).forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`)
        })
        break
      }

      case 'search': {
        const query = args.join(' ')
        if (!query) {
          console.log('❌ Usage: search <query>')
          break
        }
        
        const { data, error } = await supabase
          .from('interviews')
          .select('id, candidate_name, meeting_type, summary')
          .or(`candidate_name.ilike.%${query}%,meeting_title.ilike.%${query}%,transcript.ilike.%${query}%`)
          .limit(5)
        
        if (error) throw error
        console.table(data)
        console.log(`\n🔍 Found ${data?.length || 0} results`)
        break
      }

      case 'delete': {
        const id = args[0]
        if (!id) {
          console.log('❌ Usage: delete <id>')
          break
        }
        
        const { error } = await supabase
          .from('interviews')
          .delete()
          .eq('id', id)
        
        if (error) throw error
        console.log(`✅ Deleted meeting: ${id}`)
        break
      }

      case 'clear-all': {
        console.log('⚠️  Are you sure? Type "yes" to confirm:')
        rl.question('', async (answer) => {
          if (answer.toLowerCase() === 'yes') {
            const { error } = await supabase
              .from('interviews')
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000')
            
            if (error) throw error
            console.log('✅ All meetings deleted')
          } else {
            console.log('❌ Cancelled')
          }
          rl.prompt()
        })
        return
      }

      case 'sql': {
        const query = args.join(' ')
        if (!query) {
          console.log('❌ Usage: sql <query>')
          break
        }
        
        const { data, error } = await supabase.rpc('exec_sql', { query })
        if (error) throw error
        console.table(data)
        break
      }

      case 'exit':
        console.log('👋 Goodbye!')
        process.exit(0)

      case '':
        break

      default:
        console.log(`❌ Unknown command: ${command}`)
        console.log('Type a command or "exit" to quit')
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message || error)
  }

  rl.prompt()
})

rl.on('close', () => {
  console.log('\n👋 Goodbye!')
  process.exit(0)
})
