/**
 * db.js — WorkMax Database Service Layer
 * =======================================
 * All functions check if supabase is null before calling.
 * If Supabase is not configured (missing env vars), every function
 * returns null or [] safely, and the app falls back to SEED data.
 */

 import { supabase } from './supabase'

 // ─── MAPPERS ──────────────────────────────────────────────────────────────────
 
 const mapAdmin = (row) => row ? ({
   id:            row.id,
   role:          row.role,
   company:       row.company_id,
   name:          row.name,
   email:         row.email,
   password:      row.password_hash,
   avatar:        row.avatar,
   department:    row.department,
   position:      row.position,
   phone:         row.phone,
   companyEmail:  row.company_email,
   personalEmail: row.personal_email,
   joinDate:      row.join_date,
   blocked:       row.blocked,
 }) : null
 
 const mapEmployee = (row) => row ? ({
   id:             row.id,
   role:           'employee',
   company:        row.company_id,
   name:           row.name,
   email:          row.email,
   password:       row.password_hash,
   avatar:         row.avatar,
   department:     row.department,
   position:       row.position,
   phone:          row.phone,
   companyEmail:   row.company_email,
   personalEmail:  row.personal_email,
   joinDate:       row.join_date,
   blocked:        row.blocked,
   faceRegistered: row.face_registered,
   faceImage:      row.face_image,
   faceDescriptor: row.face_descriptor,
 }) : null
 
 const mapCompany = (row) => row ? ({
   id:            row.id,
   name:          row.name,
   industry:      row.industry,
   size:          row.size,
   plan:          row.plan,
   lat:           row.lat,
   lng:           row.lng,
   checkinRadius: row.checkin_radius ?? 200,
 }) : null
 
 // ─── AUTH ─────────────────────────────────────────────────────────────────────
 
 /**
  * loginAdmin — checks admin_users table.
  * Returns null if not found OR if Supabase is not configured.
  * App falls back to SEED when this returns null.
  */
 export const loginAdmin = async (email, password) => {
   if (!supabase) return null
   try {
     const { data, error } = await supabase
       .from('admin_users')
       .select('*')
       .eq('email', email)
       .eq('password_hash', password)
       .single()
     if (error || !data) return null
     return mapAdmin(data)
   } catch { return null }
 }
 
 /**
  * loginEmployee — checks employees table.
  * Returns null if not found OR if Supabase is not configured.
  * App falls back to SEED when this returns null.
  */
 export const loginEmployee = async (email, password) => {
   if (!supabase) return null
   try {
     const { data, error } = await supabase
       .from('employees')
       .select('*')
       .eq('email', email)
       .eq('password_hash', password)
       .single()
     if (error || !data) return null
     return mapEmployee(data)
   } catch { return null }
 }
 
 // ─── COMPANIES ────────────────────────────────────────────────────────────────
 
 export const fetchCompanies = async () => {
   if (!supabase) return []
   try {
     const { data, error } = await supabase.from('companies').select('*')
     if (error) return []
     return (data || []).map(mapCompany)
   } catch { return [] }
 }
 
 export const createCompanyInDB = async (company) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { data, error } = await supabase.from('companies').insert({
     id:             company.id,
     name:           company.name,
     industry:       company.industry,
     size:           company.size    || 0,
     plan:           company.plan    || 'Starter',
     lat:            company.lat,
     lng:            company.lng,
     checkin_radius: company.checkinRadius || 200,
   }).select().single()
   if (error) throw new Error(error.message)
   return mapCompany(data)
 }
 
 // ─── ADMINS ───────────────────────────────────────────────────────────────────
 
 export const fetchAdmins = async () => {
   if (!supabase) return []
   try {
     const { data, error } = await supabase.from('admin_users').select('*')
     if (error) return []
     return (data || []).map(mapAdmin)
   } catch { return [] }
 }
 
 export const createAdminInDB = async (admin) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { data, error } = await supabase.from('admin_users').insert({
     id:             admin.id,
     role:           admin.role,
     company_id:     admin.company,
     name:           admin.name,
     email:          admin.email,
     password_hash:  admin.password,
     avatar:         admin.avatar,
     department:     admin.department    || null,
     position:       admin.position      || null,
     phone:          admin.phone         || null,
     company_email:  admin.companyEmail  || null,
     personal_email: admin.personalEmail || null,
     join_date:      admin.joinDate,
     blocked:        false,
   }).select().single()
   if (error) throw new Error(error.message)
   return mapAdmin(data)
 }
 
 export const deleteAdminFromDB = async (adminId) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase.from('admin_users').delete().eq('id', adminId)
   if (error) throw new Error(error.message)
 }
 
 export const toggleBlockAdminInDB = async (adminId, blocked) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase.from('admin_users').update({ blocked }).eq('id', adminId)
   if (error) throw new Error(error.message)
 }
 
 export const updateAdminPasswordInDB = async (adminId, newPassword) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase
     .from('admin_users').update({ password_hash: newPassword }).eq('id', adminId)
   if (error) throw new Error(error.message)
 }
 
 export const updateAdminPersonalEmailInDB = async (adminId, personalEmail) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase
     .from('admin_users').update({ personal_email: personalEmail }).eq('id', adminId)
   if (error) throw new Error(error.message)
 }
 
 // ─── EMPLOYEES ────────────────────────────────────────────────────────────────
 
 export const fetchEmployees = async (companyId = null) => {
   if (!supabase) return []
   try {
     let query = supabase.from('employees').select('*')
     if (companyId) query = query.eq('company_id', companyId)
     const { data, error } = await query
     if (error) return []
     return (data || []).map(mapEmployee)
   } catch { return [] }
 }
 
 export const fetchAllEmployees = async () => {
   if (!supabase) return []
   try {
     const { data, error } = await supabase.from('employees').select('*')
     if (error) return []
     return (data || []).map(mapEmployee)
   } catch { return [] }
 }
 
 export const createEmployeeInDB = async (employee) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { data, error } = await supabase.from('employees').insert({
     id:              employee.id,
     company_id:      employee.company,
     name:            employee.name,
     email:           employee.email,
     password_hash:   employee.password,
     avatar:          employee.avatar,
     department:      employee.department    || null,
     position:        employee.position      || null,
     phone:           employee.phone         || null,
     company_email:   employee.companyEmail  || null,
     personal_email:  employee.personalEmail || null,
     join_date:       employee.joinDate,
     blocked:         false,
     face_registered: employee.faceRegistered || false,
     face_image:      employee.faceImage      || null,
     face_descriptor: employee.faceDescriptor || null,
   }).select().single()
   if (error) throw new Error(error.message)
   return mapEmployee(data)
 }
 
 export const deleteEmployeeFromDB = async (employeeId) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase.from('employees').delete().eq('id', employeeId)
   if (error) throw new Error(error.message)
 }
 
 export const toggleBlockEmployeeInDB = async (employeeId, blocked) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase.from('employees').update({ blocked }).eq('id', employeeId)
   if (error) throw new Error(error.message)
 }
 
 export const updateEmployeePasswordInDB = async (employeeId, newPassword) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase
     .from('employees').update({ password_hash: newPassword }).eq('id', employeeId)
   if (error) throw new Error(error.message)
 }
 
 export const updateEmployeePersonalEmailInDB = async (employeeId, personalEmail) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase
     .from('employees').update({ personal_email: personalEmail }).eq('id', employeeId)
   if (error) throw new Error(error.message)
 }
 
 export const updateEmployeeFaceInDB = async (employeeId, faceImage, faceDescriptor) => {
   if (!supabase) throw new Error('Supabase not configured')
   const { error } = await supabase.from('employees').update({
     face_registered: true,
     face_image:      faceImage      || null,
     face_descriptor: faceDescriptor || null,
   }).eq('id', employeeId)
   if (error) throw new Error(error.message)
 }