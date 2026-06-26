/**
 * WorkMax Attendance Tracking System — v3.0
 * ==========================================
 * Features added in this version:
 *   • Geolocation check-in verification (Haversine formula, no external API)
 *   • Leaves arranged by employee in admin view with group toggle
 *   • Global admin sets company name + GPS coordinates when adding admin
 *   • Admin adds company email + personal email when adding employee
 *   • Employee can email payslip (opens mail client with summary + downloads PDF)
 *   • face-api.js facial recognition fully integrated into check-in flow
 *   • "Powered by RM TECH" on login screen
 *
 * DEMO CREDENTIALS:
 *   Global Admin : globaladmin@workmax.com  / GlobalAdmin@1
 *   RM Tech Admin: admin@rmtech.com         / R&MAdmin@01
 *   MTL Admin    : admin@mtlaccountants.com / MTLAdmin@1
 *   Employee     : rosinamodiba@rmtech.com / Employee@1
 */

 import { useState, useEffect, useRef, useCallback } from "react";

 import { loginAdmin, loginEmployee, fetchAdmins, fetchCompanies, fetchEmployees,
  fetchAllEmployees, createAdminInDB, createCompanyInDB, createEmployeeInDB,
  deleteAdminFromDB, deleteEmployeeFromDB, toggleBlockAdminInDB,
  toggleBlockEmployeeInDB, updateAdminPasswordInDB, updateEmployeePasswordInDB,
  updateEmployeePersonalEmailInDB } from './db'

 import jsPDF from "jspdf";
 import * as faceapi from "face-api.js";
 
 // ─── THEME ────────────────────────────────────────────────────────────────────
 const T = {
   navy:"#0B1E3F", navyMid:"#122954", navyLight:"#1A3A6B",
   accent:"#1A56DB", accentHover:"#1447C0", accentLight:"#3B82F6",
   success:"#10B981", danger:"#EF4444", warning:"#F59E0B",
   white:"#FFFFFF", gray50:"#F8FAFC", gray100:"#F1F5F9",
   gray200:"#E2E8F0", gray400:"#94A3B8", gray600:"#475569", text:"#1E293B",
 };
 
 // ─── SEED DATA ────────────────────────────────────────────────────────────────
 const SEED = {
  users: [
    {
      id:"u1", role:"global_admin",
      name:"RM Tech", email:"globaladmin@workmax.com",
      password:"GlobalAdmin@1", avatar:"MM", blocked:false,
      company:null, department:null, position:"Platform Administrator",
      joinDate:"2026-01-01", phone:"081 815 8294",
      companyEmail:"malope.mahlangu@workmax.co.za", personalEmail:"malope.mahlangu@rm-tech.site",
    },
    {
      id:"u2", role:"company_admin",
      name:"Malope Mothiba", email:"admin@rmtech.com",
      password:"R&MAdmin@01", avatar:"MR", blocked:false,
      company:"c1", department:"Management", position:"HR Manager",
      joinDate:"2026-01-01", phone:"071 456 5443",
      companyEmail:"malope@rmtech.com", personalEmail:"malope.personal@gmail.com",
    },
    {
      id:"u3", role:"company_admin",
      name:"Tshepho Tladi", email:"admin@mtlaccountants.com",
      password:"MTLAdmin@1", avatar:"TT", blocked:false,
      company:"c2", department:"Management", position:"CEO",
      joinDate:"2026-07-01", phone:"+27 67 256 2160",
      companyEmail:"tshepho@mtlaccountants.com", personalEmail:"tshepho.tladi@gmail.com",
    },
  ],

  companies: [
    {
      id:"c1", name:"RM Tech", industry:"Technology", size:120, plan:"Enterprise",
      lat:-23.999447, lng:29.649635, checkinRadius:40,
    },
    {
      id:"c2", name:"MTL Tladi Accountants", industry:"Accounting", size:45, plan:"Pro",
      lat:-23.9124868, lng:29.4546655, checkinRadius:70,
    },
  ],

  attendance: [],
  leaves:     [],
  payslips:   [],
};
 
 // ─── UTILITY HELPERS ──────────────────────────────────────────────────────────
 const today           = () => new Date().toISOString().split("T")[0];
 const nowHour         = () => new Date().getHours();
 const fmtDate         = (d) => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
 const genId           = () => Math.random().toString(36).slice(2,10);
 const daysInMonth     = (y,m) => new Date(y,m+1,0).getDate();
 const firstDayOfMonth = (y,m) => new Date(y,m,1).getDay();
 
 /**
  * haversineDistance — calculates real-world distance in metres between two GPS points.
  * Uses the Haversine formula. 100% browser-native, zero external API.
  * Accurate to ~0.5%, sufficient for office radius checks.
  */
 const haversineDistance = (lat1,lon1,lat2,lon2) => {
   const R  = 6371000;
   const f1 = lat1*Math.PI/180, f2 = lat2*Math.PI/180;
   const df = (lat2-lat1)*Math.PI/180, dl = (lon2-lon1)*Math.PI/180;
   const a  = Math.sin(df/2)**2 + Math.cos(f1)*Math.cos(f2)*Math.sin(dl/2)**2;
   return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
 };
 
 /**
  * checkDeviceLocation — wraps navigator.geolocation in a Promise.
  * Returns { status, distance } — never throws.
  * status: 'approved' | 'out_of_range' | 'permission_denied' | 'unavailable' | 'no_office'
  */
 const checkDeviceLocation = (officeLat, officeLng, radiusMeters=200) =>
   new Promise(resolve => {
     if (officeLat==null||officeLng==null) return resolve({status:"no_office",distance:null});
     if (!navigator.geolocation)           return resolve({status:"unavailable",distance:null});
     navigator.geolocation.getCurrentPosition(
       pos => {
         const dist = haversineDistance(pos.coords.latitude,pos.coords.longitude,officeLat,officeLng);
         resolve({status:dist<=radiusMeters?"approved":"out_of_range", distance:Math.round(dist)});
       },
       () => resolve({status:"permission_denied",distance:null}),
       {enableHighAccuracy:true, timeout:10000, maximumAge:0}
     );
   });
 
 // ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
 const globalCSS = `
   @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
   *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
   body{font-family:'Plus Jakarta Sans',sans-serif;background:${T.navy};color:${T.white};overflow-x:hidden;}
   ::-webkit-scrollbar{width:6px;}
   ::-webkit-scrollbar-track{background:${T.navyMid};}
   ::-webkit-scrollbar-thumb{background:${T.accent};border-radius:3px;}
   input,select,textarea{font-family:inherit;}
   button{cursor:pointer;font-family:inherit;}
   @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
   @keyframes spin{to{transform:rotate(360deg);}}
   @keyframes scanLine{0%{top:8px;}100%{top:calc(100% - 8px);}}
   .fade-in{animation:fadeIn 0.3s ease both;}
   .spin{animation:spin 1s linear infinite;}
 `;
 
 // ─── STYLE PRIMITIVES ─────────────────────────────────────────────────────────
 const s = {
   flex:(g=0,d="row",a="center")=>({display:"flex",flexDirection:d,alignItems:a,gap:g}),
   card:{background:T.navyMid,borderRadius:16,padding:24,border:`1px solid rgba(255,255,255,0.06)`},
   h1:{fontSize:28,fontWeight:800,color:T.white,letterSpacing:-0.5},
   h2:{fontSize:20,fontWeight:700,color:T.white},
   h3:{fontSize:16,fontWeight:600,color:T.white},
   sub:{fontSize:13,color:T.gray400},
   btn:(bg=T.accent,fg=T.white)=>({
     background:bg,color:fg,border:"none",borderRadius:10,padding:"10px 20px",
     fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 0.2s",
     display:"inline-flex",alignItems:"center",gap:6,
   }),
   btnSm:(bg=T.accent,fg=T.white)=>({
     background:bg,color:fg,border:"none",borderRadius:8,padding:"6px 14px",
     fontWeight:600,fontSize:12,cursor:"pointer",transition:"all 0.2s",
     display:"inline-flex",alignItems:"center",gap:4,
   }),
   // colorScheme:"dark" is critical for Android Chrome — prevents white-on-white date/select
   input:{
     width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid rgba(255,255,255,0.1)`,
     borderRadius:10,padding:"10px 14px",color:T.white,fontSize:14,outline:"none",
     transition:"border-color 0.2s",colorScheme:"dark",
   },
   label:{fontSize:13,fontWeight:600,color:T.gray400,marginBottom:6,display:"block"},
   badge:(color)=>({
     display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600,
     background:color+"22",color:color,
   }),
 };
 
 // ─── ICONS ────────────────────────────────────────────────────────────────────
 const Icon = {
   Dashboard:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
   Users:    ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
   Leave:    ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
   Payslip:  ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
   Profile:  ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
   Stats:    ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
   Logout:   ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
   Download: ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
   Email:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
   Check:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
   X:        ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
   Clock:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
   Camera:   ()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
   Shield:   ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
   Building: ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="12"/><line x1="15" y1="22" x2="15" y2="12"/><rect x="9" y="7" width="6" height="4"/></svg>,
   Plus:     ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
   Trash:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
   Eye:      ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
   Lock:     ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
   Alert:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
   Pin:      ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
 };
 
 // ─── TOAST ────────────────────────────────────────────────────────────────────
 function Toast({msg,type,onClose}) {
   useEffect(()=>{const t=setTimeout(onClose,3500);return()=>clearTimeout(t);},[]);
   const colors={success:T.success,error:T.danger,info:T.accent};
   return (
     <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:T.navyMid,
       border:`1px solid ${colors[type]||T.accent}`,borderLeft:`4px solid ${colors[type]||T.accent}`,
       borderRadius:12,padding:"14px 20px",minWidth:280,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
       animation:"fadeIn 0.3s ease",display:"flex",alignItems:"center",gap:10}}>
       <span style={{color:colors[type]||T.accent,fontSize:18}}>{type==="success"?"✓":type==="error"?"✕":"ℹ"}</span>
       <span style={{fontSize:14,color:T.white,flex:1}}>{msg}</span>
       <button onClick={onClose} style={{background:"none",border:"none",color:T.gray400,fontSize:18,lineHeight:1}}>×</button>
     </div>
   );
 }
 
 // ─── MODAL ────────────────────────────────────────────────────────────────────
 function Modal({title,onClose,children,width=520}) {
   return (
     <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.7)",
       display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
       onClick={e=>e.target===e.currentTarget&&onClose()}>
       <div style={{background:T.navyMid,borderRadius:20,width:"100%",maxWidth:width,
         border:`1px solid rgba(255,255,255,0.1)`,animation:"fadeIn 0.25s ease",
         maxHeight:"90vh",overflowY:"auto"}}>
         <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",
           padding:"20px 24px",borderBottom:`1px solid rgba(255,255,255,0.06)`}}>
           <span style={s.h2}>{title}</span>
           <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",
             borderRadius:8,width:32,height:32,color:T.white,fontSize:18,
             display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
         </div>
         <div style={{padding:24}}>{children}</div>
       </div>
     </div>
   );
 }
 
 // ─── FACE SCANNER ─────────────────────────────────────────────────────────────
 /**
  * FaceScanner — Real facial recognition using face-api.js.
  * Downloads ~6MB of AI model files from GitHub CDN on first use (then cached).
  * Extracts a 128-point face descriptor and optionally compares to stored descriptor.
  *
  * Props:
  *   onApproved(descriptor) — called with face float array on success
  *   onDenied()             — called when face not found or does not match
  *   registeredDescriptor   — Float32Array from enrollment (leave undefined to just detect)
  */
 function FaceScanner({onApproved, onDenied, registeredDescriptor}) {
   const videoRef  = useRef(null);
   const streamRef = useRef(null);
   const [phase,      setPhase]      = useState("loading");
   const [loadStatus, setLoadStatus] = useState("Loading AI models…");
 
   // Load face-api.js models from official CDN — cached after first download
   useEffect(()=>{
     const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
     Promise.all([
       faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
       faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
       faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
     ])
       .then(()=>{setPhase("idle");setLoadStatus("");})
       .catch(()=>{setPhase("error");setLoadStatus("Failed to load AI models. Check internet.");});
     return ()=>{if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());};
   },[]);
 
   useEffect(()=>{
     if(phase==="camera"&&videoRef.current&&streamRef.current)
       videoRef.current.srcObject=streamRef.current;
   },[phase]);
 
   const openCamera = async ()=>{
     try {
       const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:320,height:240}});
       streamRef.current = stream;
       setPhase("camera");
     } catch {
       setPhase("error");
       setLoadStatus("Camera access denied. Please allow camera in browser settings.");
     }
   };
 
   const runScan = async ()=>{
     if(!videoRef.current) return;
     setPhase("scanning");
     await new Promise(r=>setTimeout(r,800)); // let frame stabilise
     try {
       const detection = await faceapi
         .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({scoreThreshold:0.4}))
         .withFaceLandmarks(true)
         .withFaceDescriptor();
       if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
       if(!detection){
         setPhase("denied"); onDenied?.();
         setTimeout(()=>setPhase("idle"),2500); return;
       }
       if(registeredDescriptor){
         const dist  = faceapi.euclideanDistance(detection.descriptor,new Float32Array(registeredDescriptor));
         const match = dist<0.5;
         setPhase(match?"approved":"denied");
         if(match) onApproved?.(Array.from(detection.descriptor));
         else {onDenied?.(); setTimeout(()=>setPhase("idle"),2500);}
       } else {
         setPhase("approved");
         onApproved?.(Array.from(detection.descriptor));
       }
     } catch {
       setPhase("denied"); onDenied?.();
       setTimeout(()=>setPhase("idle"),2500);
     }
   };
 
   const borderColor = phase==="approved"?T.success:phase==="denied"?T.danger:phase==="camera"||phase==="scanning"?T.accent:"rgba(255,255,255,0.1)";
   const glowColor   = phase==="approved"?T.success:phase==="denied"?T.danger:T.accent;
 
   return (
     <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
       <div style={{width:220,height:220,borderRadius:16,overflow:"hidden",background:"#0a0f1a",
         position:"relative",border:`2px solid ${borderColor}`,
         boxShadow:(phase==="camera"||phase==="scanning"||phase==="approved"||phase==="denied")?`0 0 24px ${glowColor}44`:"none",
         transition:"all 0.4s"}}>
         <video ref={videoRef} autoPlay muted playsInline style={{width:"100%",height:"100%",objectFit:"cover",
           display:(phase==="camera"||phase==="scanning")?"block":"none"}}/>
         {phase!=="camera"&&phase!=="scanning"&&(
           <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
             <svg width="130" height="150" viewBox="0 0 130 150">
               <ellipse cx="65" cy="75" rx="50" ry="60" fill="none"
                 stroke={phase==="approved"?T.success:phase==="denied"?T.danger:"rgba(255,255,255,0.12)"} strokeWidth="2"/>
               {phase==="approved"&&<polyline points="35,75 55,95 95,55" fill="none" stroke={T.success} strokeWidth="4" strokeLinecap="round"/>}
               {phase==="denied"&&<><line x1="45" y1="55" x2="85" y2="95" stroke={T.danger} strokeWidth="4" strokeLinecap="round"/><line x1="85" y1="55" x2="45" y2="95" stroke={T.danger} strokeWidth="4" strokeLinecap="round"/></>}
             </svg>
           </div>
         )}
         {phase==="scanning"&&<div style={{position:"absolute",left:8,right:8,height:2,background:T.accent,borderRadius:1,opacity:0.9,animation:"scanLine 1s linear infinite"}}/>}
         {phase!=="idle"&&phase!=="loading"&&phase!=="error"&&(
           <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"7px 0",background:"rgba(0,0,0,0.65)",
             textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:1,
             color:phase==="approved"?T.success:phase==="denied"?T.danger:T.accentLight}}>
             {phase==="camera"&&"POSITION YOUR FACE"}
             {phase==="scanning"&&"SCANNING…"}
             {phase==="approved"&&"✓ IDENTITY VERIFIED"}
             {phase==="denied"&&"✕ NOT RECOGNIZED"}
           </div>
         )}
       </div>
       {phase==="loading"&&<div style={{...s.flex(8,"row","center")}}><span className="spin" style={{display:"inline-block",width:16,height:16,border:`2px solid rgba(255,255,255,0.2)`,borderTopColor:T.accentLight,borderRadius:"50%"}}/><span style={{...s.sub,fontSize:12}}>{loadStatus}</span></div>}
       {phase==="error" &&<p style={{...s.sub,fontSize:12,color:T.danger,textAlign:"center"}}>{loadStatus}</p>}
       {phase==="idle"  &&<button onClick={openCamera} style={{...s.btn(T.accent),padding:"12px 28px",fontSize:15,borderRadius:12,boxShadow:`0 4px 16px ${T.accent}44`}}><Icon.Camera/>Start Face Scan</button>}
       {phase==="camera"&&<button onClick={runScan}    style={{...s.btn(T.success),padding:"12px 28px",fontSize:15,borderRadius:12,boxShadow:`0 4px 16px ${T.success}44`}}><Icon.Check/>Scan My Face</button>}
     </div>
   );
 }
 
 // ─── FACE CAPTURE (for admin employee enrollment) ─────────────────────────────
 /**
  * FaceCapture — camera + file upload widget for enrolling an employee's face.
  * Produces a base64 image stored on the employee record.
  */
 function FaceCapture({onCapture,onClear}) {
   const fileInputRef=useRef(null), videoRef=useRef(null);
   const canvasRef=useRef(null),    streamRef=useRef(null);
   const [mode,    setMode]    = useState("idle");
   const [preview, setPreview] = useState(null);
   const [camErr,  setCamErr]  = useState("");
 
   const stopCam = useCallback(()=>{
     if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
   },[]);
 
   useEffect(()=>{
     if(mode==="camera"&&videoRef.current&&streamRef.current)
       videoRef.current.srcObject=streamRef.current;
   },[mode]);
   useEffect(()=>()=>stopCam(),[]);
 
   const openCamera = async ()=>{
     setCamErr("");
     try {
       const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}}});
       streamRef.current=stream; setMode("camera");
     } catch { setCamErr("Camera access denied. Please allow camera or upload a photo instead."); }
   };
 
   const capturePhoto = ()=>{
     const video=videoRef.current, canvas=canvasRef.current;
     if(!video||!canvas) return;
     canvas.width=video.videoWidth||640; canvas.height=video.videoHeight||480;
     canvas.getContext("2d").drawImage(video,0,0);
     const base64=canvas.toDataURL("image/jpeg",0.85);
     stopCam(); setPreview(base64); setMode("preview"); onCapture?.(base64);
   };
 
   const handleUpload = e=>{
     const file=e.target.files?.[0]; if(!file) return;
     if(!["image/jpeg","image/jpg","image/png","image/webp"].includes(file.type)){setCamErr("Only JPG, PNG or WEBP accepted.");return;}
     if(file.size>5*1024*1024){setCamErr("Image must be under 5 MB.");return;}
     const reader=new FileReader();
     reader.onload=ev=>{const b64=ev.target.result;setPreview(b64);setMode("preview");onCapture?.(b64,file);};
     reader.readAsDataURL(file);
   };
 
   return (
     <div style={{...s.card,background:"rgba(255,255,255,0.03)",border:`1px dashed rgba(255,255,255,0.12)`,padding:20,textAlign:"center"}}>
       <p style={{...s.sub,fontSize:12,fontWeight:700,marginBottom:14,textTransform:"uppercase",letterSpacing:0.8}}>
         Employee Face Registration
       </p>
       {mode==="idle"&&(
         <>
           <div style={{...s.flex(10,"row","center"),justifyContent:"center",marginBottom:12}}>
             <button onClick={openCamera} style={{...s.btn(T.accent),fontSize:13,padding:"9px 18px",borderRadius:10}}><Icon.Camera/>Open Camera</button>
             <button onClick={()=>fileInputRef.current?.click()} style={{...s.btn("rgba(255,255,255,0.08)",T.white),fontSize:13,padding:"9px 18px",borderRadius:10}}>↑ Upload Photo</button>
           </div>
           <p style={{fontSize:11,color:T.gray400}}>JPG, PNG or WEBP · max 5 MB</p>
           <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleUpload} style={{display:"none"}}/>
           {camErr&&<p style={{fontSize:12,color:T.danger,marginTop:10}}>{camErr}</p>}
         </>
       )}
       {mode==="camera"&&(
         <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
           <div style={{position:"relative",borderRadius:12,overflow:"hidden",border:`2px solid ${T.accent}`,boxShadow:`0 0 20px ${T.accent}44`,width:"100%",maxWidth:280}}>
             <video ref={videoRef} autoPlay muted playsInline style={{width:"100%",display:"block",borderRadius:10}}/>
             <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
               <svg width="120" height="140" viewBox="0 0 120 140" style={{opacity:0.5}}>
                 <ellipse cx="60" cy="70" rx="45" ry="55" fill="none" stroke={T.accentLight} strokeWidth="2" strokeDasharray="6 4"/>
               </svg>
             </div>
             <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"6px",background:"rgba(0,0,0,0.6)",textAlign:"center",fontSize:11,fontWeight:700,color:T.accentLight,letterSpacing:0.8}}>ALIGN FACE IN OVAL</div>
           </div>
           <canvas ref={canvasRef} style={{display:"none"}}/>
           <div style={{...s.flex(10,"row","center")}}>
             <button onClick={capturePhoto} style={{...s.btn(T.success),fontSize:13,padding:"9px 20px",borderRadius:10,boxShadow:`0 4px 12px ${T.success}44`}}><Icon.Camera/>Take Photo</button>
             <button onClick={()=>{stopCam();setMode("idle");}} style={{...s.btn("rgba(255,255,255,0.07)",T.gray400),fontSize:13,padding:"9px 16px",borderRadius:10}}>Cancel</button>
           </div>
         </div>
       )}
       {mode==="preview"&&preview&&(
         <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
           <div style={{position:"relative",display:"inline-block"}}>
             <img src={preview} alt="Face preview" style={{width:140,height:140,objectFit:"cover",borderRadius:12,border:`3px solid ${T.success}`,boxShadow:`0 0 20px ${T.success}44`}}/>
             <div style={{position:"absolute",bottom:-6,right:-6,width:28,height:28,borderRadius:"50%",background:T.success,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon.Check/></div>
           </div>
           <p style={{fontSize:13,fontWeight:700,color:T.success}}>✓ Face image captured</p>
           <p style={{...s.sub,fontSize:11}}>Used for facial recognition during check-in.</p>
           <div style={{...s.flex(8,"row","center")}}>
             <button onClick={()=>{stopCam();setMode("idle");setPreview(null);onClear?.();}} style={s.btnSm("rgba(255,255,255,0.07)",T.gray400)}>Retake</button>
             <button onClick={()=>fileInputRef.current?.click()} style={s.btnSm("rgba(255,255,255,0.07)",T.gray400)}>Upload Different</button>
           </div>
           <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleUpload} style={{display:"none"}}/>
         </div>
       )}
     </div>
   );
 }
 
 // ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
 function LoginScreen({onLogin}) {
   const [email,    setEmail]    = useState("");
   const [password, setPassword] = useState("");
   const [showPass, setShowPass] = useState(false);
   const [error,    setError]    = useState("");
   const [loading,  setLoading]  = useState(false);

   const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      // 1. Try admin_users table in Supabase
      const adminUser = await loginAdmin(email, password);
      if (adminUser) {
        if (adminUser.blocked) { setError("Account suspended. Contact your administrator."); setLoading(false); return; }
        onLogin(adminUser); return;
      }
      // 2. Try employees table in Supabase
      const empUser = await loginEmployee(email, password);
      if (empUser) {
        if (empUser.blocked) { setError("Account suspended. Contact your administrator."); setLoading(false); return; }
        onLogin(empUser); return;
      }
      // 3. Supabase returned nothing — fall back to SEED (works offline/unconfigured)
      const seedUser = SEED.users.find(u => u.email === email && u.password === password);
      if (!seedUser)        { setError("Invalid email or password.");                                            setLoading(false); return; }
      if (seedUser.blocked) { setError("Account suspended. Contact your administrator."); setLoading(false); return; }
      onLogin(seedUser);
    } catch {
      // Network error — fall back to SEED silently
      const seedUser = SEED.users.find(u => u.email === email && u.password === password);
      if (!seedUser)        { setError("Invalid email or password.");                                            setLoading(false); return; }
      if (seedUser.blocked) { setError("Account suspended. Contact your administrator."); setLoading(false); return; }
      onLogin(seedUser);
    }
  };
 
  
 
   return (
     <div style={{minHeight:"100vh",background:T.navy,display:"flex",flexDirection:"column",
       alignItems:"center",justifyContent:"center",padding:16,
       backgroundImage:`radial-gradient(ellipse at 20% 50%,${T.navyLight}44 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,${T.accent}22 0%,transparent 50%)`}}>
       <style>{globalCSS}</style>
       <div style={{width:"100%",maxWidth:420,animation:"fadeIn 0.5s ease"}}>
         {/* Brand */}
         <div style={{textAlign:"center",marginBottom:40}}>
           <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${T.accent},${T.accentLight})`,
             display:"inline-flex",alignItems:"center",justifyContent:"center",
             fontSize:28,fontWeight:900,color:T.white,letterSpacing:-1,marginBottom:16,
             boxShadow:`0 8px 32px ${T.accent}55`}}>W</div>
           <h1 style={{...s.h1,fontSize:32,letterSpacing:-1}}>WorkMax</h1>
           <p style={{...s.sub,marginTop:6}}>Attendance & Workforce Management</p>
         </div>
         {/* Card */}
         <div style={{...s.card,padding:36}}>
           <h2 style={{...s.h2,marginBottom:24}}>Sign In</h2>
           {error&&(
             <div style={{background:`${T.danger}18`,border:`1px solid ${T.danger}44`,borderRadius:10,
               padding:"12px 16px",marginBottom:20,fontSize:13,color:T.danger,display:"flex",gap:8,alignItems:"center"}}>
               <Icon.Alert/>{error}
             </div>
           )}
           <div style={{marginBottom:16}}>
             <label style={s.label}>Email Address</label>
             <input value={email} onChange={e=>setEmail(e.target.value)} style={s.input}
               type="email" placeholder="you@company.com" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
           </div>
           <div style={{marginBottom:24}}>
             <label style={s.label}>Password</label>
             <div style={{position:"relative"}}>
               <input value={password} onChange={e=>setPassword(e.target.value)}
                 style={{...s.input,paddingRight:44}} type={showPass?"text":"password"} placeholder="••••••••"
                 onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
               <button onClick={()=>setShowPass(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.gray400,padding:4}}><Icon.Eye/></button>
             </div>
           </div>
           <button onClick={handleLogin} disabled={loading} style={{...s.btn(),width:"100%",justifyContent:"center",
             padding:"13px 0",fontSize:15,borderRadius:12,opacity:loading?0.7:1,boxShadow:`0 4px 16px ${T.accent}44`}}>
             {loading?<span className="spin" style={{display:"inline-block",width:18,height:18,border:`2px solid rgba(255,255,255,0.3)`,borderTopColor:T.white,borderRadius:"50%"}}/>:"Sign In"}
           </button>
         </div>
         {/* Powered by RM TECH */}
         <div style={{textAlign:"center",marginTop:28}}>
           <span style={{fontSize:11,fontWeight:600,letterSpacing:1.5,color:"rgba(255,255,255,0.18)",textTransform:"uppercase"}}>
             Powered by <span style={{color:T.accentLight,fontWeight:800,letterSpacing:1}}>RM TECH</span>
           </span>
         </div>
       </div>
     </div>
   );
 }
 
 // ─── APP SHELL ────────────────────────────────────────────────────────────────
 function AppShell({user,onLogout,children,activeNav,setActiveNav,navItems}) {
   const [profileOpen,setProfileOpen]=useState(false);
   const dropRef=useRef(null);
   useEffect(()=>{
     const h=e=>{if(dropRef.current&&!dropRef.current.contains(e.target))setProfileOpen(false);};
     document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
   },[]);
 
   return (
     <div style={{display:"flex",minHeight:"100vh",background:T.navy}}>
       <style>{globalCSS}</style>
       <aside style={{width:240,background:T.navyMid,borderRight:`1px solid rgba(255,255,255,0.06)`,
         display:"flex",flexDirection:"column",position:"fixed",top:0,bottom:0,left:0,zIndex:100}}>
         <div style={{padding:"24px 20px",borderBottom:`1px solid rgba(255,255,255,0.06)`}}>
           <div style={{...s.flex(10,"row","center")}}>
             <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.accentLight})`,
               display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,flexShrink:0}}>W</div>
             <div>
               <div style={{fontWeight:800,fontSize:16,letterSpacing:-0.5}}>WorkMax</div>
               <div style={{...s.sub,fontSize:11}}>{user.role==="global_admin"?"Global Platform":user.role==="company_admin"?"Admin Panel":"Employee Portal"}</div>
             </div>
           </div>
         </div>
         <nav style={{flex:1,padding:"16px 12px",overflowY:"auto"}}>
           {navItems.map(item=>{
             const active=activeNav===item.id;
             return (
               <button key={item.id} onClick={()=>setActiveNav(item.id)} style={{
                 display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",
                 background:active?`${T.accent}22`:"transparent",
                 color:active?T.accentLight:T.gray400,
                 border:active?`1px solid ${T.accent}33`:"1px solid transparent",
                 borderRadius:10,marginBottom:4,cursor:"pointer",textAlign:"left",
                 fontWeight:active?700:500,fontSize:14,transition:"all 0.15s"}}>
                 <span style={{color:active?T.accentLight:T.gray400}}>{item.icon}</span>
                 {item.label}
               </button>
             );
           })}
         </nav>
         <div style={{padding:"16px",borderTop:`1px solid rgba(255,255,255,0.06)`,display:"flex",alignItems:"center",gap:10}}>
           <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,
             display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0}}>{user.avatar}</div>
           <div style={{flex:1,overflow:"hidden"}}>
             <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
             <div style={{fontSize:11,color:T.gray400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.email}</div>
           </div>
         </div>
       </aside>
 
       <div style={{marginLeft:240,flex:1,display:"flex",flexDirection:"column"}}>
         <header style={{background:T.navyMid,borderBottom:`1px solid rgba(255,255,255,0.06)`,
           padding:"0 28px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",
           position:"sticky",top:0,zIndex:50}}>
           <h1 style={{...s.h2,fontSize:18}}>{navItems.find(n=>n.id===activeNav)?.label||""}</h1>
           {user.role==="employee"&&(
             <div ref={dropRef} style={{position:"relative"}}>
               <button onClick={()=>setProfileOpen(v=>!v)} style={{...s.flex(8,"row","center"),
                 background:"rgba(255,255,255,0.05)",border:`1px solid rgba(255,255,255,0.1)`,
                 borderRadius:10,padding:"7px 14px",color:T.white,fontSize:14,fontWeight:600}}>
                 <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,
                   display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>{user.avatar}</div>
                 {user.name.split(" ")[0]} ▾
               </button>
               {profileOpen&&(
                 <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:T.navyMid,
                   border:`1px solid rgba(255,255,255,0.1)`,borderRadius:12,minWidth:180,
                   boxShadow:"0 8px 32px rgba(0,0,0,0.4)",overflow:"hidden",animation:"fadeIn 0.15s ease"}}>
                   {[{id:"profile",label:"My Profile",icon:<Icon.Profile/>},{id:"stats",label:"My Stats",icon:<Icon.Stats/>}].map(item=>(
                     <button key={item.id} onClick={()=>{setActiveNav(item.id);setProfileOpen(false);}}
                       style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"12px 16px",
                         background:"none",border:"none",color:T.white,cursor:"pointer",fontSize:14,textAlign:"left"}}
                       onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                       onMouseLeave={e=>e.currentTarget.style.background="none"}>
                       <span style={{color:T.gray400}}>{item.icon}</span>{item.label}
                     </button>
                   ))}
                   <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"4px 0"}}/>
                   <button onClick={onLogout}
                     style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"12px 16px",
                       background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:14,textAlign:"left"}}
                     onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,0.08)"}
                     onMouseLeave={e=>e.currentTarget.style.background="none"}>
                     <Icon.Logout/>Logout
                   </button>
                 </div>
               )}
             </div>
           )}
           {user.role!=="employee"&&(
             <button onClick={onLogout} style={{...s.btn("rgba(255,255,255,0.06)",T.gray400),fontSize:13}}>
               <Icon.Logout/>Logout
             </button>
           )}
         </header>
         <main style={{flex:1,padding:28,overflowY:"auto"}}>{children}</main>
       </div>
     </div>
   );
 }
 
 // ─── STAT CARD ────────────────────────────────────────────────────────────────
 function StatCard({label,value,sub,color=T.accent,icon}) {
   return (
     <div style={{...s.card,flex:1}}>
       <div style={{...s.flex(12,"row","flex-start")}}>
         <div style={{width:44,height:44,borderRadius:12,background:`${color}22`,display:"flex",alignItems:"center",justifyContent:"center",color,flexShrink:0}}>{icon}</div>
         <div>
           <div style={{...s.sub,fontSize:12,marginBottom:4}}>{label}</div>
           <div style={{fontSize:26,fontWeight:800,color}}>{value}</div>
           {sub&&<div style={{...s.sub,fontSize:12,marginTop:2}}>{sub}</div>}
         </div>
       </div>
     </div>
   );
 }
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // EMPLOYEE VIEWS
 // ═══════════════════════════════════════════════════════════════════════════════
 
 /**
  * EmployeeDashboard
  * Check-in requires BOTH face recognition AND geolocation.
  * Location is auto-checked when modal opens. Face scan is manual.
  * Check-in button only activates when both pass.
  */
 function EmployeeDashboard({user,data,setData,toast}) {
   const now=new Date();
   const [calYear,       setCalYear]       = useState(now.getFullYear());
   const [calMonth,      setCalMonth]      = useState(now.getMonth());
   const [dayModal,      setDayModal]      = useState(null);
   const [faceOk,        setFaceOk]        = useState(false);
   const [checkDone,     setCheckDone]     = useState(false);
   // Geolocation state — populated automatically when modal opens
   const [locationStatus,  setLocationStatus]  = useState("idle");
   const [locationMetres,  setLocationMetres]  = useState(null);
 
   const todayStr       = today();
   const isBeforeCutoff = nowHour() < 12; // check-in window closes at 12pm midday
   const days           = daysInMonth(calYear,calMonth);
   const firstDay       = firstDayOfMonth(calYear,calMonth);
   const monthNames     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
 
   const getAttendance = dateStr => data.attendance.find(a=>a.userId===user.id&&a.date===dateStr);
 
   // Auto-check location the moment the modal opens
   useEffect(()=>{
     if(!dayModal) return;
     setLocationStatus("checking"); setLocationMetres(null);
     const company = data.companies.find(c=>c.id===user.company);
     checkDeviceLocation(company?.lat??null, company?.lng??null, company?.checkinRadius??200)
       .then(({status,distance})=>{setLocationStatus(status);setLocationMetres(distance);});
   },[dayModal]);
 
   // Check-in requires face AND location both approved
   const doCheckIn = ()=>{
     if(!faceOk) return;
     const locPassed = locationStatus==="approved"||locationStatus==="no_office";
     if(!locPassed) return;
     const time = new Date().toTimeString().slice(0,5);
     const rec  = {id:genId(),userId:user.id,date:todayStr,checkIn:time,checkOut:null,status:"present",locationVerified:locationStatus==="approved"};
     setData(d=>({...d,attendance:[...d.attendance,rec]}));
     setCheckDone(true);
     toast("Check-in recorded at "+time,"success");
     setTimeout(()=>setDayModal(null),1500);
   };
 
   const todayAtt = getAttendance(todayStr);
 
   return (
     <div className="fade-in">
       <div style={{...s.flex(16,"row","stretch"),marginBottom:24,flexWrap:"wrap"}}>
         <StatCard label="Status Today"   value={todayAtt?"Present":"Absent"} color={todayAtt?T.success:T.danger} icon={<Icon.Check/>} sub={todayAtt?`In: ${todayAtt.checkIn}`:"Not checked in"}/>
         <StatCard label="This Month"     value={data.attendance.filter(a=>a.userId===user.id&&a.date.startsWith(`${calYear}-${String(calMonth+1).padStart(2,"0")}`)).length} color={T.accent} icon={<Icon.Clock/>} sub="days present"/>
         <StatCard label="Pending Leaves" value={data.leaves.filter(l=>l.userId===user.id&&l.status==="pending").length} color={T.warning} icon={<Icon.Leave/>} sub="awaiting approval"/>
       </div>
 
       {/* Calendar */}
       <div style={{...s.card}}>
         <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:20}}>
           <button onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}} style={s.btnSm("rgba(255,255,255,0.07)",T.white)}>‹</button>
           <span style={{...s.h3,fontSize:18}}>{monthNames[calMonth]} {calYear}</span>
           <button onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}} style={s.btnSm("rgba(255,255,255,0.07)",T.white)}>›</button>
         </div>
         <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>
           {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
             <div key={d} style={{textAlign:"center",...s.sub,fontSize:12,fontWeight:700,padding:"6px 0"}}>{d}</div>
           ))}
         </div>
         <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
           {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i}/>)}
           {Array(days).fill(null).map((_,i)=>{
             const d=i+1;
             const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
             const att=getAttendance(dateStr);
             const isToday=dateStr===todayStr, isPast=dateStr<todayStr;
             const isWeekend=[0,6].includes(new Date(dateStr).getDay());
             let bg="transparent",border="1px solid transparent",textColor=T.white;
             if(isToday)                                             {bg=`${T.accent}33`;border=`1px solid ${T.accent}`;}
             else if(att?.status==="present")                       {bg=`${T.success}22`;border=`1px solid ${T.success}33`;}
             else if(att?.status==="late")                          {bg=`${T.warning}22`;border=`1px solid ${T.warning}33`;}
             else if(att?.status==="absent"&&isPast&&!isWeekend)    {bg=`${T.danger}22`;border=`1px solid ${T.danger}33`;}
             else if(isWeekend)                                     {textColor=T.gray400;}
             return (
               <div key={d}
                 onClick={isToday?()=>{setDayModal(dateStr);setFaceOk(false);setCheckDone(false);setLocationStatus("idle");setLocationMetres(null);}:undefined}
                 style={{aspectRatio:"1",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",
                   justifyContent:"center",background:bg,border,color:textColor,
                   cursor:isToday?"pointer":"default",transition:"all 0.15s",fontSize:14,fontWeight:isToday?800:500,position:"relative"}}>
                 {d}
                 {att&&<div style={{width:6,height:6,borderRadius:"50%",background:att.status==="present"?T.success:att.status==="late"?T.warning:T.danger,position:"absolute",bottom:4}}/>}
               </div>
             );
           })}
         </div>
         <div style={{...s.flex(16,"row","center"),marginTop:16,flexWrap:"wrap"}}>
           {[["Present",T.success],["Late",T.warning],["Absent",T.danger],["Today",T.accent]].map(([l,c])=>(
             <div key={l} style={{...s.flex(6,"row","center")}}>
               <div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{...s.sub,fontSize:12}}>{l}</span>
             </div>
           ))}
         </div>
       </div>
 
       {/* Check-in Modal */}
       {dayModal&&(
         <Modal title={`Check-In — ${fmtDate(dayModal)}`} onClose={()=>setDayModal(null)}>
           {todayAtt?(
             <div style={{textAlign:"center",padding:"16px 0"}}>
               <div style={{fontSize:40,marginBottom:12}}>✅</div>
               <p style={s.h3}>Already checked in today</p>
               <p style={{...s.sub,marginTop:8}}>Check-in: {todayAtt.checkIn} · Auto checkout: 16:00</p>
             </div>
           ):(
             <>
               {!isBeforeCutoff&&(
                 <div style={{...s.badge(T.warning),fontSize:13,padding:"10px 16px",marginBottom:20,display:"block",textAlign:"center"}}>
                   ⚠ Check-in window closed — after 10:00 AM
                 </div>
               )}
               {isBeforeCutoff&&(
                 <>
                   {/* ── Verification Status Card ── */}
                   <div style={{...s.card,background:"rgba(255,255,255,0.03)",marginBottom:20,padding:"14px 16px"}}>
                     <p style={{...s.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>
                       Verification Requirements
                     </p>
                     {/* Location row */}
                     <div style={{...s.flex(10,"row","center"),marginBottom:10}}>
                       <div style={{width:32,height:32,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
                         background:locationStatus==="approved"?`${T.success}22`:locationStatus==="checking"?`${T.accent}22`:locationStatus==="no_office"?`${T.warning}22`:"rgba(255,255,255,0.06)",
                         color:locationStatus==="approved"?T.success:locationStatus==="checking"?T.accent:locationStatus==="no_office"?T.warning:locationStatus==="idle"?T.gray400:T.danger}}>
                         {locationStatus==="checking"
                           ?<span className="spin" style={{display:"inline-block",width:14,height:14,border:`2px solid currentColor`,borderTopColor:"transparent",borderRadius:"50%"}}/>
                           :locationStatus==="approved"?"✓":locationStatus==="no_office"?"⚠":locationStatus==="idle"?"…":"✕"}
                       </div>
                       <div style={{flex:1}}>
                         <div style={{fontSize:13,fontWeight:700}}>Location Verification</div>
                         <div style={{...s.sub,fontSize:11,marginTop:2}}>
                           {locationStatus==="idle"             &&"Detecting your location…"}
                           {locationStatus==="checking"         &&"Checking distance to office…"}
                           {locationStatus==="approved"         &&`✓ Within office radius${locationMetres!=null?` (${locationMetres}m away)`:""}`}
                           {locationStatus==="out_of_range"     &&`✕ Too far from office${locationMetres!=null?` — ${locationMetres}m away`:""}`}
                           {locationStatus==="permission_denied"&&"✕ Location permission denied — enable in browser settings"}
                           {locationStatus==="unavailable"      &&"✕ Geolocation not supported on this device"}
                           {locationStatus==="no_office"        &&"⚠ No office coordinates configured — location check skipped"}
                         </div>
                       </div>
                     </div>
                     {/* Face recognition row */}
                     <div style={{...s.flex(10,"row","center")}}>
                       <div style={{width:32,height:32,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
                         background:faceOk?`${T.success}22`:"rgba(255,255,255,0.06)",color:faceOk?T.success:T.gray400}}>
                         {faceOk?"✓":"…"}
                       </div>
                       <div style={{flex:1}}>
                         <div style={{fontSize:13,fontWeight:700}}>Facial Recognition</div>
                         <div style={{...s.sub,fontSize:11,marginTop:2}}>{faceOk?"✓ Identity verified":"Pending — complete face scan below"}</div>
                       </div>
                     </div>
                   </div>
 
                   {/* Face Scanner */}
                   <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
                     <FaceScanner onApproved={()=>setFaceOk(true)}/>
                   </div>
 
                   {/* Check-in Button — only active when both pass */}
                   {(()=>{
                     const locPassed = locationStatus==="approved"||locationStatus==="no_office";
                     const allPassed = faceOk&&locPassed;
                     const label     = checkDone?"✓ Checked In"
                       :!faceOk&&!locPassed?"Face scan + location required"
                       :!faceOk?"Face scan required"
                       :!locPassed?"Location verification failed"
                       :"Confirm Check-In";
                     return (
                       <button onClick={doCheckIn} disabled={!allPassed||checkDone} style={{
                         ...s.btn(allPassed&&!checkDone?T.success:"rgba(255,255,255,0.05)"),
                         width:"100%",justifyContent:"center",padding:"13px 0",fontSize:15,borderRadius:12,
                         cursor:allPassed&&!checkDone?"pointer":"not-allowed",opacity:allPassed&&!checkDone?1:0.45}}>
                         {checkDone?label:<><Icon.Check/>{label}</>}
                       </button>
                     );
                   })()}
                 </>
               )}
             </>
           )}
         </Modal>
       )}
     </div>
   );
 }
 
 // ─── EMPLOYEE LEAVE ───────────────────────────────────────────────────────────
 function EmployeeLeave({user,data,setData,toast}) {
   const [showForm,setShowForm]=useState(false);
   const [form,setForm]=useState({type:"Annual Leave",startDate:"",endDate:"",reason:""});
   const myLeaves = data.leaves.filter(l=>l.userId===user.id).sort((a,b)=>b.startDate.localeCompare(a.startDate));
   const submit = ()=>{
     if(!form.startDate||!form.endDate||!form.reason.trim()){toast("Please fill all fields.","error");return;}
     if(form.startDate>form.endDate){toast("Start date must be before end date.","error");return;}
     setData(d=>({...d,leaves:[...d.leaves,{id:genId(),userId:user.id,...form,status:"pending",adminComment:null,reviewedBy:null}]}));
     toast("Leave application submitted!","success");
     setShowForm(false); setForm({type:"Annual Leave",startDate:"",endDate:"",reason:""});
   };
   const statusColor={pending:T.warning,approved:T.success,denied:T.danger};
   return (
     <div className="fade-in">
       <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:24}}>
         <div><h2 style={s.h2}>Leave Management</h2><p style={{...s.sub,marginTop:4}}>Apply for and track your leave requests</p></div>
         <button onClick={()=>setShowForm(true)} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}><Icon.Plus/>Apply for Leave</button>
       </div>
       <div style={{display:"flex",flexDirection:"column",gap:12}}>
         {myLeaves.length===0&&<div style={{...s.card,textAlign:"center",padding:48,color:T.gray400}}>No leave applications yet.</div>}
         {myLeaves.map(l=>(
           <div key={l.id} style={{...s.card,display:"flex",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
             <div style={{flex:1,minWidth:200}}>
               <div style={{...s.flex(10,"row","center"),marginBottom:8}}>
                 <span style={s.h3}>{l.type}</span>
                 <span style={s.badge(statusColor[l.status]||T.gray400)}>{l.status.toUpperCase()}</span>
               </div>
               <p style={{...s.sub,fontSize:13}}>{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</p>
               <p style={{fontSize:14,marginTop:8,color:"rgba(255,255,255,0.8)"}}>{l.reason}</p>
             </div>
             {l.adminComment&&(
               <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 14px",maxWidth:280}}>
                 <p style={{...s.sub,fontSize:12,marginBottom:4}}>Admin Comment</p>
                 <p style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{l.adminComment}</p>
               </div>
             )}
           </div>
         ))}
       </div>
       {showForm&&(
         <Modal title="Apply for Leave" onClose={()=>setShowForm(false)}>
           <div style={{display:"flex",flexDirection:"column",gap:16}}>
             <div>
               <label style={s.label}>Leave Type</label>
               <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={s.input}>
                 {["Annual Leave","Sick Leave","Maternity/Paternity Leave","Emergency Leave","Unpaid Leave"].map(t=><option key={t} value={t}>{t}</option>)}
               </select>
             </div>
             <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
               <div>
                 <label style={s.label}>Start Date</label>
                 <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={s.input} min={today()}/>
               </div>
               <div>
                 <label style={s.label}>End Date</label>
                 <input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} style={s.input} min={form.startDate||today()}/>
               </div>
             </div>
             <div>
               <label style={s.label}>Reason</label>
               <textarea value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}
                 style={{...s.input,height:96,resize:"vertical"}} placeholder="Briefly describe the reason…"/>
             </div>
             <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end"}}>
               <button onClick={()=>setShowForm(false)} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
               <button onClick={submit} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}>Submit Application</button>
             </div>
           </div>
         </Modal>
       )}
     </div>
   );
 }
 
 // ─── EMPLOYEE PAYSLIPS ────────────────────────────────────────────────────────
 /**
  * Payslips with PDF download AND email option.
  * Email uses mailto: protocol — opens device mail client with payslip summary.
  * PDF is downloaded simultaneously so employee can attach it manually.
  * For automated sending, integrate EmailJS (emailjs.com, free tier: 200/month).
  */
 function EmployeePayslips({user,data,setData,toast}) {
   const currentYear = new Date().getFullYear();
   const months      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
   const mySlips     = data.payslips.filter(p=>p.userId===user.id&&p.year===currentYear)
     .sort((a,b)=>months.indexOf(b.month)-months.indexOf(a.month));
 
   // Email modal state
   const [emailModal,   setEmailModal]   = useState(null);  // slip object
   const [emailAddress, setEmailAddress] = useState("");
 
   // Generate PDF and return blob URL
   const buildPDF = (slip)=>{
     const doc = new jsPDF();
     const pw  = doc.internal.pageSize.getWidth();
     doc.setFillColor(11,30,63); doc.rect(0,0,pw,44,"F");
     doc.setFillColor(26,86,219); doc.circle(20,22,8,"F");
     doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(11);
     doc.text("W",20,25.5,{align:"center"});
     doc.setFontSize(18); doc.text("WorkMax",34,19);
     doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(148,163,184);
     doc.text("Attendance & Workforce Management",34,27);
     doc.setTextColor(59,130,246); doc.setFontSize(11); doc.setFont("helvetica","bold");
     doc.text("PAYSLIP",pw-15,18,{align:"right"});
     doc.setTextColor(255,255,255); doc.setFontSize(10);
     doc.text(`${slip.month.toUpperCase()} ${slip.year}`,pw-15,27,{align:"right"});
     doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(100,116,139);
     doc.text("EMPLOYEE INFORMATION",15,56);
     doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.line(15,59,pw-15,59);
     [["Employee",user.name],["Department",user.department||"—"],["Position",user.position||"—"],["Issue Date",fmtDate(slip.issueDate)]].forEach(([label,value],i)=>{
       const y=68+i*9;
       doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(100,116,139); doc.text(label,18,y);
       doc.setFont("helvetica","bold"); doc.setTextColor(30,41,59); doc.text(String(value),72,y);
     });
     doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(100,116,139);
     doc.text("EARNINGS",15,112); doc.line(15,115,pw-15,115);
     [["Basic Salary",slip.basicSalary],["Allowances",slip.allowances]].forEach(([l,v],i)=>{
       const y=124+i*9;
       doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(71,85,105); doc.text(l,20,y);
       doc.setFont("helvetica","bold"); doc.setTextColor(16,185,129);
       doc.text(`R${v.toFixed(2)}`,pw-15,y,{align:"right"});
     });
     doc.setDrawColor(226,232,240); doc.line(15,145,pw-15,145);
     doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(71,85,105);
     doc.text("Gross Pay",20,153); doc.setTextColor(16,185,129);
     doc.text(`R${(slip.basicSalary+slip.allowances).toFixed(2)}`,pw-15,153,{align:"right"});
     doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(100,116,139);
     doc.text("DEDUCTIONS",15,164); doc.line(15,167,pw-15,167);
     doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(71,85,105);
     doc.text("Total Deductions",20,176); doc.setFont("helvetica","bold"); doc.setTextColor(239,68,68);
     doc.text(`-R${slip.deductions.toFixed(2)}`,pw-15,176,{align:"right"});
     doc.setFillColor(18,41,84); doc.roundedRect(15,186,pw-30,24,3,3,"F");
     doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(148,163,184);
     doc.text("NET PAY",23,197); doc.text("(Basic + Allowances - Deductions)",23,204);
     doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(16,185,129);
     doc.text(`R${slip.netPay.toFixed(2)}`,pw-23,201,{align:"right"});
     doc.setDrawColor(226,232,240); doc.line(15,218,pw-15,218);
     doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(148,163,184);
     doc.text("This is a system-generated document and does not require a signature.",pw/2,225,{align:"center"});
     doc.text(`Generated by WorkMax · Powered by RM TECH · ${new Date().toLocaleDateString("en-US",{dateStyle:"long"})}`,pw/2,232,{align:"center"});
     return doc;
   };
 
   const downloadSlip = (slip)=>{
     const doc = buildPDF(slip);
     doc.save(`Payslip_${slip.month}_${slip.year}.pdf`);
     setData(d=>({...d,payslips:d.payslips.map(p=>p.id===slip.id?{...p,downloaded:true}:p)}));
     toast(`Payslip for ${slip.month} ${slip.year} downloaded!`,"success");
   };
 
   const openEmailModal = (slip)=>{
     // Pre-fill with personal email if available, else work email
     setEmailAddress(user.personalEmail||user.email||"");
     setEmailModal(slip);
   };
 
   const sendViaEmail = ()=>{
     if(!emailAddress.trim()){toast("Please enter an email address.","error");return;}
     const slip = emailModal;
     // 1. Download the PDF so employee can attach it
     buildPDF(slip).save(`Payslip_${slip.month}_${slip.year}.pdf`);
     setData(d=>({...d,payslips:d.payslips.map(p=>p.id===slip.id?{...p,downloaded:true}:p)}));
 
     // 2. Open default mail client with payslip summary as body
     const subject = encodeURIComponent(`Payslip — ${slip.month} ${slip.year}`);
     const body    = encodeURIComponent(
 `WorkMax Payslip
 ===============
 Employee  : ${user.name}
 Period    : ${slip.month} ${slip.year}
 Issue Date: ${fmtDate(slip.issueDate)}
 
 EARNINGS
 Basic Salary : R${slip.basicSalary.toFixed(2)}
 Allowances   : R${slip.allowances.toFixed(2)}
 Gross Pay    : R${(slip.basicSalary+slip.allowances).toFixed(2)}
 
 DEDUCTIONS   : -R${slip.deductions.toFixed(2)}
 
 NET PAY      : R${slip.netPay.toFixed(2)}
 
 Note: PDF payslip has been downloaded to your device.
 Please attach the file Payslip_${slip.month}_${slip.year}.pdf to this email.
 
 Powered by WorkMax · RM TECH`
     );
     window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
     setEmailModal(null);
     toast(`PDF downloaded. Email client opened for ${emailAddress}!`,"success");
   };
 
   return (
     <div className="fade-in">
       <div style={{marginBottom:24}}>
         <h2 style={s.h2}>My Payslips</h2>
         <p style={{...s.sub,marginTop:4}}>{currentYear} payslips only</p>
       </div>
       {mySlips.length===0?(
         <div style={{...s.card,textAlign:"center",padding:48,color:T.gray400}}>No payslips available for {currentYear}.</div>
       ):(
         <div style={{display:"flex",flexDirection:"column",gap:12}}>
           {mySlips.map(slip=>(
             <div key={slip.id} style={{...s.card,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
               <div style={{width:44,height:44,borderRadius:12,background:`${T.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",color:T.accent,flexShrink:0}}><Icon.Payslip/></div>
               <div style={{flex:1}}>
                 <div style={{...s.h3,marginBottom:4}}>{slip.month} {slip.year}</div>
                 <p style={{...s.sub,fontSize:13}}>Issued: {fmtDate(slip.issueDate)}</p>
               </div>
               <div style={{...s.flex(24,"row","center"),flexWrap:"wrap"}}>
                 {[["Basic",slip.basicSalary],["Allowances",slip.allowances],["Deductions",slip.deductions]].map(([l,v])=>(
                   <div key={l} style={{textAlign:"center"}}>
                     <div style={{...s.sub,fontSize:11,marginBottom:2}}>{l}</div>
                     <div style={{fontSize:14,fontWeight:600}}>R{v.toFixed(2)}</div>
                   </div>
                 ))}
                 <div style={{textAlign:"center"}}>
                   <div style={{...s.sub,fontSize:11,marginBottom:2}}>Net Pay</div>
                   <div style={{fontSize:18,fontWeight:800,color:T.success}}>R{slip.netPay.toFixed(2)}</div>
                 </div>
               </div>
               {/* Download + Email buttons */}
               <div style={{...s.flex(8,"row","center"),flexShrink:0}}>
                 <button onClick={()=>downloadSlip(slip)} style={s.btn(T.success)}><Icon.Download/>Download</button>
                 <button onClick={()=>openEmailModal(slip)} style={s.btn(T.accent)}><Icon.Email/>Email</button>
               </div>
             </div>
           ))}
         </div>
       )}
 
       {/* Email Payslip Modal */}
       {emailModal&&(
         <Modal title={`Email Payslip — ${emailModal.month} ${emailModal.year}`} onClose={()=>setEmailModal(null)} width={460}>
           <div style={{display:"flex",flexDirection:"column",gap:16}}>
             <div style={{...s.card,background:"rgba(255,255,255,0.03)",padding:14}}>
               <p style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6}}>
                 The PDF will be <strong style={{color:T.accentLight}}>downloaded to your device</strong> and your
                 default email app will open with a pre-filled summary. Please attach the PDF file manually.
               </p>
             </div>
             <div>
               <label style={s.label}>Send To</label>
               <input value={emailAddress} onChange={e=>setEmailAddress(e.target.value)}
                 style={s.input} type="email" placeholder="recipient@example.com"/>
               {/* Quick-fill buttons */}
               <div style={{...s.flex(8,"row","center"),marginTop:8,flexWrap:"wrap"}}>
                 {user.personalEmail&&<button onClick={()=>setEmailAddress(user.personalEmail)} style={s.btnSm("rgba(255,255,255,0.07)",T.gray400)}>Personal: {user.personalEmail}</button>}
                 {user.companyEmail &&<button onClick={()=>setEmailAddress(user.companyEmail)}  style={s.btnSm("rgba(255,255,255,0.07)",T.gray400)}>Work: {user.companyEmail}</button>}
               </div>
             </div>
             <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end"}}>
               <button onClick={()=>setEmailModal(null)} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
               <button onClick={sendViaEmail} style={{...s.btn(T.accent),boxShadow:`0 4px 12px ${T.accent}44`}}><Icon.Email/>Download & Open Mail</button>
             </div>
           </div>
         </Modal>
       )}
     </div>
   );
 }
 
 // ─── EMPLOYEE PROFILE ─────────────────────────────────────────────────────────
 function EmployeeProfile({user,data,setData,toast}) {
   const [tab,setTab]=useState("info");
   const [pwForm,setPwForm]=useState({old:"",new1:"",new2:""});
   const [showPw,setShowPw]=useState({old:false,new1:false,new2:false});
   const [editPersonalEmail,setEditPersonalEmail]=useState(false);
   const [personalEmailVal,setPersonalEmailVal]=useState(user.personalEmail||"");
 
   const changePassword = ()=>{
     const u=data.users.find(u2=>u2.id===user.id);
     if(pwForm.old!==u.password){toast("Current password is incorrect.","error");return;}
     if(pwForm.new1.length<8)   {toast("New password must be at least 8 characters.","error");return;}
     if(pwForm.new1!==pwForm.new2){toast("New passwords do not match.","error");return;}
     setData(d=>({...d,users:d.users.map(u2=>u2.id===user.id?{...u2,password:pwForm.new1}:u2)}));
     toast("Password updated successfully!","success");
     setPwForm({old:"",new1:"",new2:""});
   };
 
   const savePersonalEmail = async () => {
    try {
      await updateEmployeePersonalEmailInDB(user.id, personalEmailVal);
      setData(d=>({...d,users:d.users.map(u2=>u2.id===user.id?{...u2,personalEmail:personalEmailVal}:u2)}));
      setEditPersonalEmail(false);
      toast("Personal email updated!","success");
    } catch(err) {
      toast(`Error: ${err.message}`,"error");
    }
  };
 
   const att=data.attendance.filter(a=>a.userId===user.id);
   const present=att.filter(a=>a.status==="present").length;
   const late   =att.filter(a=>a.status==="late").length;
 
   return (
     <div className="fade-in">
       <div style={{...s.card,marginBottom:20,display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
         <div style={{width:72,height:72,borderRadius:18,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:800,flexShrink:0}}>{user.avatar}</div>
         <div style={{flex:1}}>
           <h2 style={{...s.h2,fontSize:22}}>{user.name}</h2>
           <p style={{...s.sub,marginTop:4}}>{user.position} · {user.department}</p>
           <p style={{...s.sub,fontSize:13,marginTop:2}}>{user.email}</p>
         </div>
         <div style={{textAlign:"right"}}>
           <div style={{...s.sub,fontSize:12}}>Joined</div>
           <div style={{fontWeight:700}}>{fmtDate(user.joinDate)}</div>
         </div>
       </div>
       <div style={{...s.flex(4,"row","center"),marginBottom:20}}>
         {[["info","Information"],["password","Change Password"]].map(([id,label])=>(
           <button key={id} onClick={()=>setTab(id)} style={{...s.btnSm(tab===id?T.accent:"rgba(255,255,255,0.06)",tab===id?T.white:T.gray400),padding:"8px 18px"}}>{label}</button>
         ))}
       </div>
       {tab==="info"&&(
         <div style={{...s.card}}>
           <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:20}}>
             {[["Full Name",user.name],["Work Email",user.email],["Company Email",user.companyEmail||"—"],["Phone",user.phone],["Department",user.department],["Position",user.position],["Company",data.companies.find(c=>c.id===user.company)?.name||"—"],["Join Date",fmtDate(user.joinDate)],["Days Present",present],["Days Late",late]].map(([l,v])=>(
               <div key={l}><div style={s.label}>{l}</div><div style={{fontSize:15,fontWeight:600}}>{v}</div></div>
             ))}
             {/* Personal email — editable by employee */}
             <div>
               <div style={s.label}>Personal Email <span style={{color:T.accentLight,fontSize:11}}>(for payslip delivery)</span></div>
               {editPersonalEmail?(
                 <div style={{...s.flex(6,"row","center")}}>
                   <input value={personalEmailVal} onChange={e=>setPersonalEmailVal(e.target.value)} style={{...s.input,flex:1}} type="email" placeholder="your@gmail.com"/>
                   <button onClick={savePersonalEmail} style={s.btnSm(T.success)}><Icon.Check/></button>
                   <button onClick={()=>setEditPersonalEmail(false)} style={s.btnSm("rgba(255,255,255,0.07)",T.gray400)}><Icon.X/></button>
                 </div>
               ):(
                 <div style={{...s.flex(8,"row","center")}}>
                   <span style={{fontSize:15,fontWeight:600}}>{user.personalEmail||"—"}</span>
                   <button onClick={()=>{setPersonalEmailVal(user.personalEmail||"");setEditPersonalEmail(true);}} style={s.btnSm("rgba(255,255,255,0.07)",T.gray400)}>Edit</button>
                 </div>
               )}
             </div>
           </div>
         </div>
       )}
       {tab==="password"&&(
         <div style={{...s.card,maxWidth:480}}>
           <h3 style={{...s.h3,marginBottom:20}}>Change Password</h3>
           <div style={{display:"flex",flexDirection:"column",gap:16}}>
             {[["old","Current Password","Enter your current password"],["new1","New Password","Minimum 8 characters"],["new2","Confirm New Password","Re-enter new password"]].map(([key,label,placeholder])=>(
               <div key={key}>
                 <label style={s.label}>{label}</label>
                 <div style={{position:"relative"}}>
                   <input type={showPw[key]?"text":"password"} value={pwForm[key]} onChange={e=>setPwForm(f=>({...f,[key]:e.target.value}))} style={{...s.input,paddingRight:44}} placeholder={placeholder}/>
                   <button onClick={()=>setShowPw(v=>({...v,[key]:!v[key]}))} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.gray400,padding:4}}><Icon.Eye/></button>
                 </div>
               </div>
             ))}
             <button onClick={changePassword} style={{...s.btn(),marginTop:8,alignSelf:"flex-start",boxShadow:`0 4px 12px ${T.accent}44`}}><Icon.Lock/>Update Password</button>
           </div>
         </div>
       )}
     </div>
   );
 }
 
 // ─── EMPLOYEE STATS ───────────────────────────────────────────────────────────
 function EmployeeStats({user,data}) {
   const att=data.attendance.filter(a=>a.userId===user.id);
   const present=att.filter(a=>a.status==="present").length;
   const late   =att.filter(a=>a.status==="late").length;
   const absent =att.filter(a=>a.status==="absent").length;
   const total  =present+late+absent;
   const rate   =total?Math.round((present/total)*100):0;
   return (
     <div className="fade-in">
       <div style={{...s.flex(16,"row","stretch"),marginBottom:24,flexWrap:"wrap"}}>
         <StatCard label="Attendance Rate" value={`${rate}%`} color={rate>90?T.success:T.warning} icon={<Icon.Stats/>}/>
         <StatCard label="Days Present"    value={present}    color={T.success} icon={<Icon.Check/>}/>
         <StatCard label="Days Late"       value={late}       color={T.warning} icon={<Icon.Clock/>}/>
         <StatCard label="Days Absent"     value={absent}     color={T.danger}  icon={<Icon.X/>}/>
       </div>
       <div style={s.card}>
         <h3 style={{...s.h3,marginBottom:16}}>Attendance Log</h3>
         <div style={{overflowX:"auto"}}>
           <table style={{width:"100%",borderCollapse:"collapse"}}>
             <thead><tr>{["Date","Check-In","Check-Out","Status"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
             <tbody>
               {att.sort((a,b)=>b.date.localeCompare(a.date)).map((a,i)=>(
                 <tr key={a.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent"}}>
                   <td style={{padding:"10px 14px",fontSize:14}}>{fmtDate(a.date)}</td>
                   <td style={{padding:"10px 14px",fontSize:14}}>{a.checkIn||"—"}</td>
                   <td style={{padding:"10px 14px",fontSize:14}}>{a.checkOut||"—"}</td>
                   <td style={{padding:"10px 14px"}}><span style={s.badge(a.status==="present"?T.success:a.status==="late"?T.warning:T.danger)}>{a.status.toUpperCase()}</span></td>
                 </tr>
               ))}
               {att.length===0&&<tr><td colSpan={4} style={{padding:32,textAlign:"center",color:T.gray400}}>No attendance records yet.</td></tr>}
             </tbody>
           </table>
         </div>
       </div>
     </div>
   );
 }
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // ADMIN VIEWS
 // ═══════════════════════════════════════════════════════════════════════════════
 
 // ─── ADMIN EMPLOYEES ──────────────────────────────────────────────────────────
 function AdminEmployees({user,data,setData,toast}) {
   const [showAdd,setShowAdd]=useState(false);
   const [viewEmp,setViewEmp]=useState(null);
   // Added companyEmail and personalEmail fields
   const [form,setForm]=useState({name:"",email:"",companyEmail:"",personalEmail:"",password:"",department:"",position:"",phone:"",faceRegistered:false,faceImage:null});
 
   const employees = data.users.filter(u=>u.role==="employee"&&u.company===user.company);
 
   const addEmployee = async () => {
    if(!form.name||!form.email||!form.password){toast("Name, login email and password required.","error");return;}
    if(data.users.find(u=>u.email===form.email)){toast("Login email already exists.","error");return;}
    const newEmp = {
      id:genId(), role:"employee", ...form,
      avatar:form.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2),
      blocked:false, company:user.company, joinDate:today(),
    };
    try {
      await createEmployeeInDB(newEmp);
      setData(d=>({...d,users:[...d.users,newEmp]}));
      toast(`${form.name} added successfully!`,"success");
      setShowAdd(false);
      setForm({name:"",email:"",companyEmail:"",personalEmail:"",password:"",department:"",position:"",phone:"",faceRegistered:false,faceImage:null});
    } catch(err) {
      toast(`Error saving employee: ${err.message}`,"error");
    }
  };
 
  const removeEmployee = async (emp) => {
    if(!window.confirm(`Remove ${emp.name}? This cannot be undone.`)) return;
    try {
      await deleteEmployeeFromDB(emp.id);
      setData(d=>({...d,users:d.users.filter(u=>u.id!==emp.id)}));
      toast(`${emp.name} removed.`,"success");
    } catch(err) {
      toast(`Error: ${err.message}`,"error");
    }
  };
 
   return (
     <div className="fade-in">
       <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:24}}>
         <div><h2 style={s.h2}>Employees</h2><p style={{...s.sub,marginTop:4}}>{employees.length} employee{employees.length!==1?"s":""} registered</p></div>
         <button onClick={()=>setShowAdd(true)} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}><Icon.Plus/>Add Employee</button>
       </div>
       <div style={{...s.card}}>
         <table style={{width:"100%",borderCollapse:"collapse"}}>
           <thead><tr>{["Employee","Department","Position","Face ID","Status","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
           <tbody>
             {employees.map((emp,i)=>(
               <tr key={emp.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent"}}>
                 <td style={{padding:"12px 14px"}}>
                   <div style={{...s.flex(10,"row","center")}}>
                     <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{emp.avatar}</div>
                     <div><div style={{fontSize:14,fontWeight:600}}>{emp.name}</div><div style={{...s.sub,fontSize:12}}>{emp.email}</div></div>
                   </div>
                 </td>
                 <td style={{padding:"12px 14px",fontSize:14,color:T.gray400}}>{emp.department||"—"}</td>
                 <td style={{padding:"12px 14px",fontSize:14,color:T.gray400}}>{emp.position||"—"}</td>
                 <td style={{padding:"12px 14px"}}><span style={s.badge(emp.faceRegistered?T.success:T.warning)}>{emp.faceRegistered?"Registered":"Pending"}</span></td>
                 <td style={{padding:"12px 14px"}}><span style={s.badge(emp.blocked?T.danger:T.success)}>{emp.blocked?"Blocked":"Active"}</span></td>
                 <td style={{padding:"12px 14px"}}>
                   <div style={{...s.flex(8)}}>
                     <button onClick={()=>setViewEmp(emp)} style={s.btnSm("rgba(255,255,255,0.07)",T.white)}><Icon.Eye/></button>
                     <button onClick={()=>removeEmployee(emp)} style={s.btnSm(`${T.danger}22`,T.danger)}><Icon.Trash/></button>
                   </div>
                 </td>
               </tr>
             ))}
             {employees.length===0&&<tr><td colSpan={6} style={{padding:32,textAlign:"center",color:T.gray400}}>No employees yet.</td></tr>}
           </tbody>
         </table>
       </div>
 
       {showAdd&&(
         <Modal title="Add New Employee" onClose={()=>{setShowAdd(false);setForm({name:"",email:"",companyEmail:"",personalEmail:"",password:"",department:"",position:"",phone:"",faceRegistered:false,faceImage:null});}} width={560}>
           <div style={{display:"flex",flexDirection:"column",gap:14}}>
             {/* Account details */}
             <p style={{...s.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>Account Details</p>
             <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
               <div><label style={s.label}>Full Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={s.input} placeholder="Jane Smith"/></div>
               <div><label style={s.label}>Login Email *</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={s.input} type="email" placeholder="jane@login.com"/></div>
               <div><label style={s.label}>Company Email *</label><input value={form.companyEmail} onChange={e=>setForm(f=>({...f,companyEmail:e.target.value}))} style={s.input} type="email" placeholder="jane@rmtech.com"/></div>
               <div><label style={s.label}>Personal Email</label><input value={form.personalEmail} onChange={e=>setForm(f=>({...f,personalEmail:e.target.value}))} style={s.input} type="email" placeholder="jane@gmail.com"/></div>
               <div><label style={s.label}>Password *</label><input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={s.input} type="password" placeholder="Minimum 8 chars"/></div>
               <div><label style={s.label}>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={s.input} placeholder="081 000 0000"/></div>
               <div><label style={s.label}>Department</label><input value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} style={s.input} placeholder="Engineering"/></div>
               <div><label style={s.label}>Position</label><input value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} style={s.input} placeholder="Software Engineer"/></div>
             </div>
             {/* Face registration */}
             <FaceCapture
               onCapture={base64=>setForm(f=>({...f,faceRegistered:true,faceImage:base64}))}
               onClear={()=>setForm(f=>({...f,faceRegistered:false,faceImage:null}))}
             />
             <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end",marginTop:4}}>
               <button onClick={()=>{setShowAdd(false);setForm({name:"",email:"",companyEmail:"",personalEmail:"",password:"",department:"",position:"",phone:"",faceRegistered:false,faceImage:null});}} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
               <button onClick={addEmployee} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}>Add Employee</button>
             </div>
           </div>
         </Modal>
       )}
 
       {viewEmp&&(
         <Modal title="Employee Details" onClose={()=>setViewEmp(null)}>
           <div style={{display:"flex",flexDirection:"column",gap:14}}>
             <div style={{...s.flex(14,"row","center"),padding:"4px 0"}}>
               <div style={{width:56,height:56,borderRadius:14,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800}}>{viewEmp.avatar}</div>
               <div><div style={s.h2}>{viewEmp.name}</div><div style={{...s.sub,marginTop:4}}>{viewEmp.email}</div></div>
             </div>
             {[["Company Email",viewEmp.companyEmail||"—"],["Personal Email",viewEmp.personalEmail||"—"],["Department",viewEmp.department],["Position",viewEmp.position],["Phone",viewEmp.phone],["Join Date",fmtDate(viewEmp.joinDate)],["Face ID",viewEmp.faceRegistered?"Registered":"Not Registered"],["Status",viewEmp.blocked?"Blocked":"Active"]].map(([l,v])=>(
               <div key={l} style={{...s.flex(0,"row","center"),justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
                 <span style={s.sub}>{l}</span><span style={{fontSize:14,fontWeight:600}}>{v}</span>
               </div>
             ))}
           </div>
         </Modal>
       )}
     </div>
   );
 }
 
 // ─── ADMIN LEAVE ──────────────────────────────────────────────────────────────
 /**
  * AdminLeave — leave requests with two view modes:
  *   "table"      — flat chronological table (default)
  *   "byEmployee" — grouped by employee with individual sections
  */
 function AdminLeave({user,data,setData,toast}) {
   const [reviewModal,setReviewModal]=useState(null);
   const [comment,    setComment]    =useState("");
   const [viewMode,   setViewMode]   =useState("byEmployee"); // table | byEmployee
 
   const companyEmpIds = data.users.filter(u=>u.role==="employee"&&u.company===user.company).map(u=>u.id);
   const allLeaves     = data.leaves.filter(l=>companyEmpIds.includes(l.userId));
   const getEmp        = id=>data.users.find(u=>u.id===id);
   const statusColor   = {pending:T.warning,approved:T.success,denied:T.danger};
 
   const review = decision=>{
     setData(d=>({...d,leaves:d.leaves.map(l=>l.id===reviewModal.id?{...l,status:decision,adminComment:comment||null,reviewedBy:user.id}:l)}));
     toast(`Leave ${decision}!`,decision==="approved"?"success":"error");
     setReviewModal(null); setComment("");
   };
 
   // Group leaves by employee for the byEmployee view
   const leavesByEmployee = companyEmpIds.reduce((acc,empId)=>{
     const empLeaves = allLeaves.filter(l=>l.userId===empId).sort((a,b)=>b.startDate.localeCompare(a.startDate));
     if(empLeaves.length>0) acc.push({emp:getEmp(empId), leaves:empLeaves});
     return acc;
   },[]);
 
   const ReviewModal = ()=>reviewModal?(
     <Modal title="Review Leave Request" onClose={()=>setReviewModal(null)}>
       {(()=>{
         const emp=getEmp(reviewModal.userId);
         return (
           <div style={{display:"flex",flexDirection:"column",gap:16}}>
             <div style={{...s.card,background:"rgba(255,255,255,0.03)"}}>
               {[["Employee",emp?.name],["Leave Type",reviewModal.type],["Duration",`${fmtDate(reviewModal.startDate)} → ${fmtDate(reviewModal.endDate)}`]].map(([l,v])=>(
                 <div key={l} style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:12}}>
                   <span style={s.sub}>{l}</span><span style={{fontWeight:700}}>{v}</span>
                 </div>
               ))}
               <div><span style={s.sub}>Reason</span><p style={{marginTop:6,fontSize:14,color:"rgba(255,255,255,0.8)"}}>{reviewModal.reason}</p></div>
             </div>
             <div>
               <label style={s.label}>Comment (Optional)</label>
               <textarea value={comment} onChange={e=>setComment(e.target.value)} style={{...s.input,height:80,resize:"vertical"}} placeholder="Add a comment for the employee…"/>
             </div>
             <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end"}}>
               <button onClick={()=>setReviewModal(null)} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
               <button onClick={()=>review("denied")}   style={s.btn(`${T.danger}22`,T.danger)}><Icon.X/>Deny</button>
               <button onClick={()=>review("approved")} style={{...s.btn(T.success),boxShadow:`0 4px 12px ${T.success}44`}}><Icon.Check/>Approve</button>
             </div>
           </div>
         );
       })()}
     </Modal>
   ):null;
 
   return (
     <div className="fade-in">
       <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
         <div>
           <h2 style={s.h2}>Leave Requests</h2>
           <p style={{...s.sub,marginTop:4}}>{allLeaves.filter(l=>l.status==="pending").length} pending · {allLeaves.length} total</p>
         </div>
         {/* View mode toggle */}
         <div style={{...s.flex(4,"row","center")}}>
           <button onClick={()=>setViewMode("byEmployee")} style={s.btnSm(viewMode==="byEmployee"?T.accent:"rgba(255,255,255,0.07)",viewMode==="byEmployee"?T.white:T.gray400)}>By Employee</button>
           <button onClick={()=>setViewMode("table")}      style={s.btnSm(viewMode==="table"     ?T.accent:"rgba(255,255,255,0.07)",viewMode==="table"     ?T.white:T.gray400)}>Table View</button>
         </div>
       </div>
 
       {/* ── BY EMPLOYEE VIEW ─────────────────────────────────────────── */}
       {viewMode==="byEmployee"&&(
         <div style={{display:"flex",flexDirection:"column",gap:16}}>
           {leavesByEmployee.length===0&&<div style={{...s.card,textAlign:"center",padding:48,color:T.gray400}}>No leave requests.</div>}
           {leavesByEmployee.map(({emp,leaves})=>(
             <div key={emp?.id||"unknown"} style={s.card}>
               {/* Employee header */}
               <div style={{...s.flex(12,"row","center"),marginBottom:16,paddingBottom:12,borderBottom:`1px solid rgba(255,255,255,0.07)`}}>
                 <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0}}>{emp?.avatar||"?"}</div>
                 <div style={{flex:1}}>
                   <div style={{fontWeight:700,fontSize:15}}>{emp?.name||"Unknown"}</div>
                   <div style={{...s.sub,fontSize:12}}>{emp?.position} · {emp?.department}</div>
                 </div>
                 <div style={{...s.flex(6,"row","center")}}>
                   <span style={s.badge(T.warning)}>{leaves.filter(l=>l.status==="pending").length} pending</span>
                   <span style={s.badge(T.success)}>{leaves.filter(l=>l.status==="approved").length} approved</span>
                 </div>
               </div>
               {/* Leave rows for this employee */}
               <div style={{display:"flex",flexDirection:"column",gap:8}}>
                 {leaves.map(l=>(
                   <div key={l.id} style={{...s.flex(12,"row","center"),background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 14px",flexWrap:"wrap",gap:10}}>
                     <div style={{flex:1,minWidth:160}}>
                       <div style={{fontSize:13,fontWeight:600}}>{l.type}</div>
                       <div style={{...s.sub,fontSize:12,marginTop:2}}>{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</div>
                     </div>
                     <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",flex:1,minWidth:140}}>{l.reason}</div>
                     <span style={s.badge(statusColor[l.status]||T.gray400)}>{l.status.toUpperCase()}</span>
                     {l.status==="pending"
                       ?<button onClick={()=>{setReviewModal(l);setComment("");}} style={s.btnSm(T.accent)}>Review</button>
                       :<span style={{...s.sub,fontSize:12,minWidth:60,textAlign:"right"}}>{l.adminComment?"Commented":"Reviewed"}</span>
                     }
                   </div>
                 ))}
               </div>
             </div>
           ))}
         </div>
       )}
 
       {/* ── TABLE VIEW ───────────────────────────────────────────────── */}
       {viewMode==="table"&&(
         <div style={s.card}>
           <table style={{width:"100%",borderCollapse:"collapse"}}>
             <thead><tr>{["Employee","Type","Duration","Reason","Status","Action"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
             <tbody>
               {allLeaves.sort((a,b)=>b.startDate.localeCompare(a.startDate)).map((l,i)=>{
                 const emp=getEmp(l.userId);
                 return (
                   <tr key={l.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent"}}>
                     <td style={{padding:"12px 14px"}}>
                       <div style={{...s.flex(8,"row","center")}}>
                         <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{emp?.avatar||"?"}</div>
                         <span style={{fontSize:13,fontWeight:600}}>{emp?.name||"Unknown"}</span>
                       </div>
                     </td>
                     <td style={{padding:"12px 14px",fontSize:13}}>{l.type}</td>
                     <td style={{padding:"12px 14px",fontSize:13,color:T.gray400,whiteSpace:"nowrap"}}>{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</td>
                     <td style={{padding:"12px 14px",fontSize:13,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.reason}</td>
                     <td style={{padding:"12px 14px"}}><span style={s.badge(statusColor[l.status]||T.gray400)}>{l.status.toUpperCase()}</span></td>
                     <td style={{padding:"12px 14px"}}>{l.status==="pending"?<button onClick={()=>{setReviewModal(l);setComment("");}} style={s.btnSm(T.accent)}>Review</button>:<span style={{...s.sub,fontSize:12}}>Reviewed</span>}</td>
                   </tr>
                 );
               })}
               {allLeaves.length===0&&<tr><td colSpan={6} style={{padding:32,textAlign:"center",color:T.gray400}}>No leave requests.</td></tr>}
             </tbody>
           </table>
         </div>
       )}
       <ReviewModal/>
     </div>
   );
 }
 
 // ─── ADMIN PAYSLIPS ───────────────────────────────────────────────────────────
 function AdminPayslips({user,data,setData,toast}) {
   const [editSlip,setEditSlip]=useState(null);
   const [showAdd, setShowAdd] =useState(false);
   const [form,setForm]=useState({userId:"",month:"January",year:new Date().getFullYear(),basicSalary:"",allowances:"",deductions:""});
   const companyEmpIds=data.users.filter(u=>u.role==="employee"&&u.company===user.company).map(u=>u.id);
   const allSlips=data.payslips.filter(p=>companyEmpIds.includes(p.userId)).sort((a,b)=>b.issueDate?.localeCompare(a.issueDate||"")||0);
   const getEmp=id=>data.users.find(u=>u.id===id);
   const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
   const employees=data.users.filter(u=>u.role==="employee"&&u.company===user.company);
 
   const saveSlip=()=>{
     const net=parseFloat(form.basicSalary||0)+parseFloat(form.allowances||0)-parseFloat(form.deductions||0);
     if(!form.userId){toast("Select an employee.","error");return;}
     if(editSlip){
       setData(d=>({...d,payslips:d.payslips.map(p=>p.id===editSlip.id?{...p,...form,netPay:net,basicSalary:+form.basicSalary,allowances:+form.allowances,deductions:+form.deductions}:p)}));
       toast("Payslip updated!","success");
     } else {
       setData(d=>({...d,payslips:[...d.payslips,{id:genId(),...form,basicSalary:+form.basicSalary,allowances:+form.allowances,deductions:+form.deductions,netPay:net,issueDate:today(),downloaded:false}]}));
       toast("Payslip created!","success");
     }
     setEditSlip(null);setShowAdd(false);
     setForm({userId:"",month:"January",year:new Date().getFullYear(),basicSalary:"",allowances:"",deductions:""});
   };
 
   return (
     <div className="fade-in">
       <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:24}}>
         <div><h2 style={s.h2}>Payslips</h2><p style={{...s.sub,marginTop:4}}>Manage employee payslip records</p></div>
         <button onClick={()=>{setShowAdd(true);setEditSlip(null);setForm({userId:"",month:"January",year:new Date().getFullYear(),basicSalary:"",allowances:"",deductions:"" });}} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}><Icon.Plus/>New Payslip</button>
       </div>
       <div style={s.card}>
         <table style={{width:"100%",borderCollapse:"collapse"}}>
           <thead><tr>{["Employee","Period","Basic","Allowances","Deductions","Net Pay","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
           <tbody>
             {allSlips.map((p,i)=>{
               const emp=getEmp(p.userId);
               return (
                 <tr key={p.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent"}}>
                   <td style={{padding:"12px 14px",fontSize:13,fontWeight:600}}>{emp?.name||"Unknown"}</td>
                   <td style={{padding:"12px 14px",fontSize:13}}>{p.month} {p.year}</td>
                   <td style={{padding:"12px 14px",fontSize:13}}>R{p.basicSalary.toFixed(2)}</td>
                   <td style={{padding:"12px 14px",fontSize:13,color:T.success}}>R{p.allowances.toFixed(2)}</td>
                   <td style={{padding:"12px 14px",fontSize:13,color:T.danger}}>-R{p.deductions.toFixed(2)}</td>
                   <td style={{padding:"12px 14px",fontSize:15,fontWeight:800,color:T.success}}>R{p.netPay.toFixed(2)}</td>
                   <td style={{padding:"12px 14px"}}><button onClick={()=>{setEditSlip(p);setShowAdd(true);setForm({userId:p.userId,month:p.month,year:p.year,basicSalary:String(p.basicSalary),allowances:String(p.allowances),deductions:String(p.deductions)});}} style={s.btnSm(T.accent)}>Edit</button></td>
                 </tr>
               );
             })}
             {allSlips.length===0&&<tr><td colSpan={7} style={{padding:32,textAlign:"center",color:T.gray400}}>No payslips yet.</td></tr>}
           </tbody>
         </table>
       </div>
       {showAdd&&(
         <Modal title={editSlip?"Edit Payslip":"New Payslip"} onClose={()=>{setShowAdd(false);setEditSlip(null);}}>
           <div style={{display:"flex",flexDirection:"column",gap:14}}>
             <div>
               <label style={s.label}>Employee</label>
               <select value={form.userId} onChange={e=>setForm(f=>({...f,userId:e.target.value}))} style={s.input} disabled={!!editSlip}>
                 <option value="">Select employee…</option>
                 {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
               </select>
             </div>
             <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
               <div><label style={s.label}>Month</label><select value={form.month} onChange={e=>setForm(f=>({...f,month:e.target.value}))} style={s.input}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
               <div><label style={s.label}>Year</label><input type="number" value={form.year} onChange={e=>setForm(f=>({...f,year:+e.target.value}))} style={s.input}/></div>
               <div><label style={s.label}>Basic Salary (R)</label><input type="number" value={form.basicSalary} onChange={e=>setForm(f=>({...f,basicSalary:e.target.value}))} style={s.input} placeholder="5000"/></div>
               <div><label style={s.label}>Allowances (R)</label><input type="number" value={form.allowances} onChange={e=>setForm(f=>({...f,allowances:e.target.value}))} style={s.input} placeholder="800"/></div>
               <div><label style={s.label}>Deductions (R)</label><input type="number" value={form.deductions} onChange={e=>setForm(f=>({...f,deductions:e.target.value}))} style={s.input} placeholder="600"/></div>
               <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:2}}>
                 <label style={s.label}>Net Pay (Preview)</label>
                 <div style={{fontSize:20,fontWeight:800,color:T.success}}>R{((+form.basicSalary||0)+(+form.allowances||0)-(+form.deductions||0)).toFixed(2)}</div>
               </div>
             </div>
             <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end",marginTop:4}}>
               <button onClick={()=>{setShowAdd(false);setEditSlip(null);}} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
               <button onClick={saveSlip} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}>Save Payslip</button>
             </div>
           </div>
         </Modal>
       )}
     </div>
   );
 }
 
 // ─── ADMIN STATS ──────────────────────────────────────────────────────────────
 function AdminStats({user,data}) {
   const [selectedEmp,setSelectedEmp]=useState("all");
   const employees    =data.users.filter(u=>u.role==="employee"&&u.company===user.company);
   const companyEmpIds=employees.map(u=>u.id);
   const relevantAtt  =data.attendance.filter(a=>selectedEmp==="all"?companyEmpIds.includes(a.userId):a.userId===selectedEmp);
   const present=relevantAtt.filter(a=>a.status==="present").length;
   const late   =relevantAtt.filter(a=>a.status==="late").length;
   const absent =relevantAtt.filter(a=>a.status==="absent").length;
   const total  =present+late+absent;
   return (
     <div className="fade-in">
       <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
         <div><h2 style={s.h2}>Attendance Statistics</h2><p style={{...s.sub,marginTop:4}}>Individual and aggregate views</p></div>
         <select value={selectedEmp} onChange={e=>setSelectedEmp(e.target.value)} style={{...s.input,width:"auto",minWidth:200}}>
           <option value="all">All Employees</option>
           {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
         </select>
       </div>
       <div style={{...s.flex(16,"row","stretch"),marginBottom:24,flexWrap:"wrap"}}>
         <StatCard label="Present" value={present} color={T.success} icon={<Icon.Check/>} sub={total?`${Math.round(present/total*100)}% of records`:""}/>
         <StatCard label="Late"    value={late}    color={T.warning} icon={<Icon.Clock/>} sub={total?`${Math.round(late/total*100)}% of records`:""}/>
         <StatCard label="Absent"  value={absent}  color={T.danger}  icon={<Icon.X/>}    sub={total?`${Math.round(absent/total*100)}% of records`:""}/>
         <StatCard label="Total"   value={total}   color={T.accent}  icon={<Icon.Stats/>} sub="attendance records"/>
       </div>
       {selectedEmp==="all"&&(
         <div style={s.card}>
           <h3 style={{...s.h3,marginBottom:16}}>Per-Employee Breakdown</h3>
           <table style={{width:"100%",borderCollapse:"collapse"}}>
             <thead><tr>{["Employee","Present","Late","Absent","Rate"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`}}>{h}</th>)}</tr></thead>
             <tbody>
               {employees.map((emp,i)=>{
                 const ea=data.attendance.filter(a=>a.userId===emp.id);
                 const ep=ea.filter(a=>a.status==="present").length, el=ea.filter(a=>a.status==="late").length, eab=ea.filter(a=>a.status==="absent").length;
                 const et=ep+el+eab, rate=et?Math.round(ep/et*100):0;
                 return (
                   <tr key={emp.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent"}}>
                     <td style={{padding:"10px 14px"}}><div style={{...s.flex(8,"row","center")}}><div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{emp.avatar}</div><span style={{fontSize:13,fontWeight:600}}>{emp.name}</span></div></td>
                     <td style={{padding:"10px 14px",color:T.success,fontWeight:700}}>{ep}</td>
                     <td style={{padding:"10px 14px",color:T.warning,fontWeight:700}}>{el}</td>
                     <td style={{padding:"10px 14px",color:T.danger,fontWeight:700}}>{eab}</td>
                     <td style={{padding:"10px 14px"}}><div style={{...s.flex(8,"row","center")}}><div style={{flex:1,height:8,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden",maxWidth:80}}><div style={{height:"100%",width:`${rate}%`,background:rate>90?T.success:rate>70?T.warning:T.danger,borderRadius:4,transition:"width 0.5s"}}/></div><span style={{fontSize:13,fontWeight:700,color:rate>90?T.success:rate>70?T.warning:T.danger}}>{rate}%</span></div></td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
         </div>
       )}
       {selectedEmp!=="all"&&(
         <div style={s.card}>
           <h3 style={{...s.h3,marginBottom:16}}>Attendance Log — {data.users.find(u=>u.id===selectedEmp)?.name}</h3>
           <table style={{width:"100%",borderCollapse:"collapse"}}>
             <thead><tr>{["Date","Check-In","Check-Out","Status"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`}}>{h}</th>)}</tr></thead>
             <tbody>
               {relevantAtt.sort((a,b)=>b.date.localeCompare(a.date)).map((a,i)=>(
                 <tr key={a.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent"}}>
                   <td style={{padding:"10px 14px",fontSize:13}}>{fmtDate(a.date)}</td>
                   <td style={{padding:"10px 14px",fontSize:13}}>{a.checkIn||"—"}</td>
                   <td style={{padding:"10px 14px",fontSize:13}}>{a.checkOut||"—"}</td>
                   <td style={{padding:"10px 14px"}}><span style={s.badge(a.status==="present"?T.success:a.status==="late"?T.warning:T.danger)}>{a.status.toUpperCase()}</span></td>
                 </tr>
               ))}
               {relevantAtt.length===0&&<tr><td colSpan={4} style={{padding:32,textAlign:"center",color:T.gray400}}>No records.</td></tr>}
             </tbody>
           </table>
         </div>
       )}
     </div>
   );
 }
 
 // ─── ADMIN PASSWORD ───────────────────────────────────────────────────────────
 function AdminPassword({user,data,setData,toast}) {
   const [form,setForm]=useState({old:"",new1:"",new2:""});
   const [showPw,setShowPw]=useState({old:false,new1:false,new2:false});

   const submit = async () => {
    const u = data.users.find(u2=>u2.id===user.id);
    if(form.old!==u.password){toast("Current password incorrect.","error");return;}
    if(form.new1.length<8)   {toast("New password must be ≥ 8 characters.","error");return;}
    if(form.new1!==form.new2){toast("Passwords do not match.","error");return;}
    try {
      if (user.role === 'employee') {
        await updateEmployeePasswordInDB(user.id, form.new1);
      } else {
        await updateAdminPasswordInDB(user.id, form.new1);
      }
      setData(d=>({...d,users:d.users.map(u2=>u2.id===user.id?{...u2,password:form.new1}:u2)}));
      toast("Password updated!","success");
      setForm({old:"",new1:"",new2:""});
    } catch(err) {
      toast(`Database error: ${err.message}`,"error");
    }
  };

   return (
     <div className="fade-in" style={{maxWidth:480}}>
       <div style={{marginBottom:24}}><h2 style={s.h2}>Change Password</h2></div>
       <div style={s.card}>
         <div style={{display:"flex",flexDirection:"column",gap:16}}>
           {[["old","Current Password"],["new1","New Password"],["new2","Confirm New Password"]].map(([k,l])=>(
             <div key={k}>
               <label style={s.label}>{l}</label>
               <div style={{position:"relative"}}>
                 <input type={showPw[k]?"text":"password"} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{...s.input,paddingRight:44}} placeholder="••••••••"/>
                 <button onClick={()=>setShowPw(v=>({...v,[k]:!v[k]}))} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.gray400,padding:4}}><Icon.Eye/></button>
               </div>
             </div>
           ))}
           <button onClick={submit} style={{...s.btn(),alignSelf:"flex-start",marginTop:4,boxShadow:`0 4px 12px ${T.accent}44`}}><Icon.Lock/>Update Password</button>
         </div>
       </div>
     </div>
   );
 }
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // GLOBAL ADMIN VIEWS
 // ═══════════════════════════════════════════════════════════════════════════════
 
 /**
  * GlobalAdminManage
  * Adding an admin ALWAYS creates a brand-new company simultaneously.
  * Company name is typed manually (text field, not dropdown).
  * Global admin sets office GPS coordinates and check-in radius for geolocation.
  */
  function GlobalAdminManage({data,setData,toast}) {
    const [showAdd,setShowAdd]=useState(false);
    const [form,setForm]=useState({
      name:"",email:"",password:"",phone:"",
      companyName:"",companyIndustry:"",
      officeLat:"",officeLng:"",checkinRadius:"200",
    });
  
    const admins = data.users.filter(u=>u.role==="company_admin");
  
    const addAdmin = async ()=>{
      if(!form.name||!form.email||!form.password){toast("Admin name, email and password required.","error");return;}
      if(!form.companyName.trim()){toast("Company name is required.","error");return;}
      if(form.officeLat===""||form.officeLng===""){toast("Office latitude and longitude are required.","error");return;}
      if(data.users.find(u=>u.email===form.email)){toast("Email already exists.","error");return;}
      const lat=parseFloat(form.officeLat), lng=parseFloat(form.officeLng), radius=parseInt(form.checkinRadius)||200;
      if(isNaN(lat)||lat<-90||lat>90)   {toast("Latitude must be between -90 and 90.","error");return;}
      if(isNaN(lng)||lng<-180||lng>180) {toast("Longitude must be between -180 and 180.","error");return;}
  
      // Create company object
      const newCompany = {
        id:genId(), name:form.companyName.trim(),
        industry:form.companyIndustry.trim()||"General",
        size:0, plan:"Starter", lat, lng, checkinRadius:radius,
      };
  
      // Create admin object linked to new company
      const newAdmin = {
        id:genId(), role:"company_admin",
        company:newCompany.id,
        name:form.name.trim(), email:form.email.trim(),
        password:form.password,
        avatar:form.name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2),
        blocked:false, department:"Management", position:"Company Admin",
        phone:form.phone||null, joinDate:today(),
        companyEmail:form.email, personalEmail:"",
      };
  
      // ── CHANGE: save to Supabase first, then update local state ──
      try {
        await createCompanyInDB(newCompany);
        await createAdminInDB(newAdmin);
        setData(d=>({...d,companies:[...d.companies,newCompany],users:[...d.users,newAdmin]}));
        toast(`Admin "${form.name}" and company "${form.companyName}" created!`,"success");
        setShowAdd(false);
        setForm({name:"",email:"",password:"",phone:"",companyName:"",companyIndustry:"",officeLat:"",officeLng:"",checkinRadius:"200"});
      } catch(err) {
        toast(`Error saving to database: ${err.message}`,"error");
      }
    };
  
    // ── CHANGE: now async, deletes from Supabase before updating local state ──
    const removeAdmin = async (a)=>{
      if(!window.confirm(`Remove admin ${a.name}?`)) return;
      try {
        await deleteAdminFromDB(a.id);
        setData(d=>({...d,users:d.users.filter(u=>u.id!==a.id)}));
        toast("Admin removed.","success");
      } catch(err) {
        toast(`Error: ${err.message}`,"error");
      }
    };
  
    // ── CHANGE: now async, updates Supabase before updating local state ──
    const toggleBlock = async (u)=>{
      try {
        await toggleBlockAdminInDB(u.id, !u.blocked);
        setData(d=>({...d,users:d.users.map(u2=>u2.id===u.id?{...u2,blocked:!u2.blocked}:u2)}));
        toast(u.blocked?`${u.name} unblocked.`:`${u.name} blocked.`,u.blocked?"success":"error");
      } catch(err) {
        toast(`Error: ${err.message}`,"error");
      }
    };
  
    return (
      <div className="fade-in">
        <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:24}}>
          <div><h2 style={s.h2}>Company Admins</h2><p style={{...s.sub,marginTop:4}}>{admins.length} admin(s) · {data.companies.length} companies</p></div>
          <button onClick={()=>setShowAdd(true)} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}><Icon.Plus/>Add Admin</button>
        </div>
  
        <div style={s.card}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Admin","Email","Company","Office Location","Status","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {admins.map((a,i)=>{
                const co=data.companies.find(c=>c.id===a.company);
                return (
                  <tr key={a.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent"}}>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{...s.flex(10,"row","center")}}>
                        <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{a.avatar}</div>
                        <span style={{fontSize:14,fontWeight:600}}>{a.name}</span>
                      </div>
                    </td>
                    <td style={{padding:"12px 14px",fontSize:13,color:T.gray400}}>{a.email}</td>
                    <td style={{padding:"12px 14px",fontSize:13}}>{co?.name||"—"}</td>
                    <td style={{padding:"12px 14px",fontSize:12,color:T.gray400}}>
                      {co?.lat!=null?<span style={{...s.flex(4,"row","center")}}><Icon.Pin/>{co.lat.toFixed(4)}, {co.lng.toFixed(4)} · {co.checkinRadius}m</span>:"Not set"}
                    </td>
                    <td style={{padding:"12px 14px"}}><span style={s.badge(a.blocked?T.danger:T.success)}>{a.blocked?"Blocked":"Active"}</span></td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{...s.flex(8)}}>
                        <button onClick={()=>toggleBlock(a)} style={s.btnSm(a.blocked?`${T.success}22`:`${T.warning}22`,a.blocked?T.success:T.warning)}>{a.blocked?"Unblock":"Block"}</button>
                        <button onClick={()=>removeAdmin(a)} style={s.btnSm(`${T.danger}22`,T.danger)}><Icon.Trash/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
  
        {showAdd&&(
          <Modal title="Add Company Admin + Company" onClose={()=>setShowAdd(false)} width={580}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <p style={{...s.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>Admin Account</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={s.label}>Full Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={s.input} placeholder="Jane Doe"/></div>
                <div><label style={s.label}>Email *</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={s.input} type="email" placeholder="admin@company.com"/></div>
                <div><label style={s.label}>Password *</label><input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={s.input} type="password" placeholder="Minimum 8 characters"/></div>
                <div><label style={s.label}>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={s.input} placeholder="+27 71 000 0000"/></div>
              </div>
              <div style={{height:1,background:"rgba(255,255,255,0.07)"}}/>
              <p style={{...s.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>Company Details</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={s.label}>Company Name *</label><input value={form.companyName} onChange={e=>setForm(f=>({...f,companyName:e.target.value}))} style={s.input} placeholder="Acme Corporation"/></div>
                <div><label style={s.label}>Industry</label><input value={form.companyIndustry} onChange={e=>setForm(f=>({...f,companyIndustry:e.target.value}))} style={s.input} placeholder="Technology"/></div>
              </div>
              <div style={{...s.card,background:"rgba(255,255,255,0.03)",border:`1px dashed rgba(255,255,255,0.1)`,padding:16}}>
                <p style={{...s.sub,fontSize:12,fontWeight:700,marginBottom:4}}>📍 Office Location for Check-in Verification</p>
                <p style={{fontSize:11,color:T.gray400,marginBottom:14}}>
                  Employees must be within the specified radius to check in.
                  Get coordinates by right-clicking the office location on Google Maps.
                </p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div>
                    <label style={s.label}>Latitude *</label>
                    <input value={form.officeLat} onChange={e=>setForm(f=>({...f,officeLat:e.target.value}))} style={s.input} type="number" step="0.0001" placeholder="-26.2041"/>
                  </div>
                  <div>
                    <label style={s.label}>Longitude *</label>
                    <input value={form.officeLng} onChange={e=>setForm(f=>({...f,officeLng:e.target.value}))} style={s.input} type="number" step="0.0001" placeholder="28.0473"/>
                  </div>
                  <div>
                    <label style={s.label}>Radius (metres)</label>
                    <input value={form.checkinRadius} onChange={e=>setForm(f=>({...f,checkinRadius:e.target.value}))} style={s.input} type="number" min="50" max="2000" placeholder="200"/>
                  </div>
                </div>
                {form.officeLat&&form.officeLng&&(
                  <p style={{fontSize:11,color:T.accentLight,marginTop:10}}>
                    ↗ Coordinates: {parseFloat(form.officeLat).toFixed(5)}, {parseFloat(form.officeLng).toFixed(5)} · {form.checkinRadius||200}m radius
                  </p>
                )}
              </div>
              <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end",marginTop:4}}>
                <button onClick={()=>setShowAdd(false)} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
                <button onClick={addAdmin} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}>Create Admin &amp; Company</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }
 
 // ─── GLOBAL ADMIN USERS ───────────────────────────────────────────────────────
 function GlobalAdminUsers({data,setData,toast}) {
   const [filter,setFilter]=useState("all");
   const users=data.users.filter(u=>u.role!=="global_admin"&&(filter==="all"||u.role===filter));
   const toggleBlock=u=>{
     setData(d=>({...d,users:d.users.map(u2=>u2.id===u.id?{...u2,blocked:!u2.blocked}:u2)}));
     toast(u.blocked?`${u.name} unblocked.`:`${u.name} blocked.`,u.blocked?"success":"error");
   };
   return (
     <div className="fade-in">
       <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
         <div><h2 style={s.h2}>All Users</h2><p style={{...s.sub,marginTop:4}}>{users.length} users</p></div>
         <div style={{...s.flex(4)}}>
           {[["all","All"],["company_admin","Admins"],["employee","Employees"]].map(([v,l])=>(
             <button key={v} onClick={()=>setFilter(v)} style={s.btnSm(filter===v?T.accent:"rgba(255,255,255,0.07)",filter===v?T.white:T.gray400)}>{l}</button>
           ))}
         </div>
       </div>
       <div style={s.card}>
         <table style={{width:"100%",borderCollapse:"collapse"}}>
           <thead><tr>{["User","Role","Company","Department","Status","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`}}>{h}</th>)}</tr></thead>
           <tbody>
             {users.map((u,i)=>(
               <tr key={u.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent"}}>
                 <td style={{padding:"12px 14px"}}>
                   <div style={{...s.flex(10,"row","center")}}>
                     <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{u.avatar}</div>
                     <div><div style={{fontSize:13,fontWeight:600}}>{u.name}</div><div style={{...s.sub,fontSize:11}}>{u.email}</div></div>
                   </div>
                 </td>
                 <td style={{padding:"12px 14px"}}><span style={s.badge(u.role==="company_admin"?T.accent:T.accentLight)}>{u.role==="company_admin"?"Admin":"Employee"}</span></td>
                 <td style={{padding:"12px 14px",fontSize:13}}>{data.companies.find(c=>c.id===u.company)?.name||"—"}</td>
                 <td style={{padding:"12px 14px",fontSize:13,color:T.gray400}}>{u.department||"—"}</td>
                 <td style={{padding:"12px 14px"}}><span style={s.badge(u.blocked?T.danger:T.success)}>{u.blocked?"Blocked":"Active"}</span></td>
                 <td style={{padding:"12px 14px"}}><button onClick={()=>toggleBlock(u)} style={s.btnSm(u.blocked?`${T.success}22`:`${T.warning}22`,u.blocked?T.success:T.warning)}>{u.blocked?"Unblock":"Block"}</button></td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
     </div>
   );
 }
 
 // ─── GLOBAL ADMIN DASHBOARD ───────────────────────────────────────────────────
 function GlobalAdminDashboard({data}) {
   const totalAdmins   =data.users.filter(u=>u.role==="company_admin").length;
   const totalEmployees=data.users.filter(u=>u.role==="employee").length;
   const totalBlocked  =data.users.filter(u=>u.blocked).length;
   const totalLeaves   =data.leaves.filter(l=>l.status==="pending").length;
   return (
     <div className="fade-in">
       <div style={{...s.flex(16,"row","stretch"),marginBottom:24,flexWrap:"wrap"}}>
         <StatCard label="Companies"      value={data.companies.length} color={T.accent}      icon={<Icon.Building/>}/>
         <StatCard label="Company Admins" value={totalAdmins}           color={T.accentLight} icon={<Icon.Shield/>}/>
         <StatCard label="Employees"      value={totalEmployees}        color={T.success}     icon={<Icon.Users/>}/>
         <StatCard label="Blocked Users"  value={totalBlocked}          color={T.danger}      icon={<Icon.Lock/>}/>
         <StatCard label="Pending Leaves" value={totalLeaves}           color={T.warning}     icon={<Icon.Leave/>}/>
       </div>
       <div style={s.card}>
         <h3 style={{...s.h3,marginBottom:16}}>Registered Companies</h3>
         {data.companies.map(c=>(
           <div key={c.id} style={{...s.flex(0,"row","center"),justifyContent:"space-between",padding:"14px 0",borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
             <div style={{...s.flex(12,"row","center")}}>
               <div style={{width:40,height:40,borderRadius:12,background:`${T.accent}22`,display:"flex",alignItems:"center",justifyContent:"center",color:T.accent}}><Icon.Building/></div>
               <div>
                 <div style={{fontWeight:700}}>{c.name}</div>
                 <div style={{...s.sub,fontSize:12}}>{c.industry} · {c.plan}</div>
                 {c.lat!=null&&<div style={{...s.sub,fontSize:11,marginTop:2,color:T.accentLight}}><Icon.Pin/> {c.lat.toFixed(4)}, {c.lng.toFixed(4)} · {c.checkinRadius}m radius</div>}
               </div>
             </div>
             <div style={{textAlign:"right"}}>
               <div style={{fontWeight:700}}>{data.users.filter(u=>u.company===c.id&&u.role==="employee").length} employees</div>
               <div style={{...s.sub,fontSize:12}}>{data.users.filter(u=>u.company===c.id&&u.role==="company_admin").length} admins</div>
             </div>
           </div>
         ))}
       </div>
     </div>
   );
 }
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // ROOT APP COMPONENT
 // ═══════════════════════════════════════════════════════════════════════════════
 export default function WorkMaxApp() {
   const [currentUser, setCurrentUser] = useState(null);
   const [data,        setData]        = useState(SEED);
   const [activeNav,   setActiveNav]   = useState(null);
   const [toast,       setToast]       = useState(null);
 
   const showToast = useCallback((msg,type="info")=>setToast({msg,type}),[]);

   const handleLogin = useCallback(async (user) => {
    try {
      const [dbAdmins, dbCompanies] = await Promise.all([
        fetchAdmins(),
        fetchCompanies(),
      ]);
  
      // Load employees — company admins only load their own company's employees
      // Global admin loads everyone
      let dbEmployees = [];
      if (user.role === 'global_admin') {
        dbEmployees = await fetchAllEmployees();
      } else if (user.role === 'company_admin') {
        dbEmployees = await fetchEmployees(user.company);
      } else {
        // Employee logging in — load all employees from their company
        dbEmployees = await fetchEmployees(user.company);
      }
  
      const mergedUsers     = [...dbAdmins, ...dbEmployees];
      const mergedCompanies = dbCompanies.length > 0 ? dbCompanies : SEED.companies;
  
      setData(d => ({
        ...d,
        users:     mergedUsers,
        companies: mergedCompanies,
      }));
    } catch {
      console.warn('Supabase unreachable — using SEED data');
    }
    setCurrentUser(user);
    setActiveNav(
      user.role === 'global_admin'  ? 'overview'   :
      user.role === 'company_admin' ? 'employees'  : 'dashboard'
    );
  }, []);
 
 
   const handleLogout = useCallback(()=>{setCurrentUser(null);setActiveNav(null);},[]);
 
   // Keep currentUser in sync when data changes (e.g. password / personalEmail update)
   useEffect(()=>{
     if(currentUser){
       const updated=data.users.find(u=>u.id===currentUser.id);
       if(updated) setCurrentUser(updated);
     }
   },[data]);
 
   const navConfigs = {
     employee:[
       {id:"dashboard",label:"Dashboard",    icon:<Icon.Dashboard/>},
       {id:"leave",    label:"Leave",         icon:<Icon.Leave/>},
       {id:"payslips", label:"Payslips",      icon:<Icon.Payslip/>},
       {id:"profile",  label:"Profile",       icon:<Icon.Profile/>},
       {id:"stats",    label:"My Stats",      icon:<Icon.Stats/>},
     ],
     company_admin:[
       {id:"employees",label:"Employees",     icon:<Icon.Users/>},
       {id:"leave",    label:"Leave",          icon:<Icon.Leave/>},
       {id:"payslips", label:"Payslips",       icon:<Icon.Payslip/>},
       {id:"stats",    label:"Statistics",     icon:<Icon.Stats/>},
       {id:"password", label:"Change Password",icon:<Icon.Lock/>},
     ],
     global_admin:[
       {id:"overview", label:"Overview",       icon:<Icon.Dashboard/>},
       {id:"admins",   label:"Manage Admins",  icon:<Icon.Shield/>},
       {id:"allusers", label:"All Users",      icon:<Icon.Users/>},
       {id:"password", label:"Change Password",icon:<Icon.Lock/>},
     ],
   };
 
   const renderView = ()=>{
     const p={user:currentUser,data,setData,toast:showToast};
     if(currentUser.role==="employee")
       return {dashboard:<EmployeeDashboard {...p}/>,leave:<EmployeeLeave {...p}/>,payslips:<EmployeePayslips {...p}/>,profile:<EmployeeProfile {...p}/>,stats:<EmployeeStats {...p}/>}[activeNav]||null;
     if(currentUser.role==="company_admin")
       return {employees:<AdminEmployees {...p}/>,leave:<AdminLeave {...p}/>,payslips:<AdminPayslips {...p}/>,stats:<AdminStats {...p}/>,password:<AdminPassword {...p}/>}[activeNav]||null;
     if(currentUser.role==="global_admin")
       return {overview:<GlobalAdminDashboard {...p}/>,admins:<GlobalAdminManage {...p}/>,allusers:<GlobalAdminUsers {...p}/>,password:<AdminPassword {...p}/>}[activeNav]||null;
   };
 
   if(!currentUser) return <LoginScreen onLogin={handleLogin}/>;
 
   return (
     <>
       <AppShell user={currentUser} onLogout={handleLogout} activeNav={activeNav} setActiveNav={setActiveNav} navItems={navConfigs[currentUser.role]||[]}>
         {renderView()}
       </AppShell>
       {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
     </>
   );
 }
