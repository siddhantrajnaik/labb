import { createClient } from 'npm:@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  try{
    const url=Deno.env.get('SUPABASE_URL')!
    const pubJson=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
    const secJson=Deno.env.get('SUPABASE_SECRET_KEYS')
    const publishable=pubJson?JSON.parse(pubJson).default:Deno.env.get('SUPABASE_ANON_KEY')!
    const secret=secJson?JSON.parse(secJson).default:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const auth=req.headers.get('Authorization')||''
    const caller=createClient(url,publishable,{global:{headers:{Authorization:auth}},auth:{persistSession:false}})
    const {data:{user},error:userError}=await caller.auth.getUser()
    if(userError||!user) return Response.json({error:'Unauthorized'},{status:401,headers:cors})
    const {data:profile,error:pError}=await caller.from('profiles').select('lab_id,role').eq('id',user.id).single()
    if(pError||profile?.role!=='admin') return Response.json({error:'Admin required'},{status:403,headers:cors})
    const {email,display_name,role='member',redirectTo}=await req.json()
    if(!email||!['admin','member'].includes(role)) return Response.json({error:'Invalid input'},{status:400,headers:cors})
    const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}})
    const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{display_name}})
    if(error) throw error
    if(!data.user) throw new Error('Invite did not return a user')
    const {error:insertError}=await admin.from('profiles').insert({id:data.user.id,lab_id:profile.lab_id,display_name:display_name||email,role})
    if(insertError) throw insertError
    return Response.json({ok:true,user_id:data.user.id},{headers:{...cors,'Content-Type':'application/json'}})
  }catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:400,headers:{...cors,'Content-Type':'application/json'}})}
})
