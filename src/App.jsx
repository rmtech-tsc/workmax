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
 import ReactDOM from "react-dom";

 import { loginAdmin, loginEmployee, fetchAdmins, fetchCompanies, fetchEmployees,
  fetchAllEmployees, createAdminInDB, createCompanyInDB, createEmployeeInDB,
  deleteAdminFromDB, deleteEmployeeFromDB, toggleBlockAdminInDB,
  toggleBlockEmployeeInDB, updateAdminPasswordInDB, updateEmployeePasswordInDB,
  updateEmployeePersonalEmailInDB,updateEmployeeFaceInDB,
  fetchLeaves, fetchAllLeaves, createLeaveInDB, updateLeaveInDB,
  fetchAttendance, fetchAllAttendance, createAttendanceInDB,
  fetchPayslips, fetchAllPayslips, createPayslipInDB, updatePayslipInDB,
  updateEmployeeBankingInDB, fetchPayments, fetchAllPayments, createPaymentInDB,} from './db'

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
      lat:-23.999447, lng:29.649635, checkinRadius:150,
    },
    {
      id:"c2", name:"MTL Tladi Accountants", industry:"Accounting", size:45, plan:"Pro",
      lat:-23.9124868, lng:29.4546655, checkinRadius:150,
    },
  ],

  attendance: [],
  leaves:     [],
  payslips:   [],
  payments: [],
};
 

 // ─── EMPLOYEE BANKING PAGE ─────────────────────────────

 function EmployeeBanking({user,data,setData,toast}) {
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({
    bankName:user.bankName||"", accountHolder:user.accountHolder||user.name,
    accountNumber:user.accountNumber||"", branchCode:user.branchCode||"",
    accountType:user.accountType||"Cheque",
  });

  const save=async()=>{
    if(!form.bankName.trim()||!form.accountNumber.trim()||!form.branchCode.trim()){
      toast("Bank name, account number and branch code are required.","error");return;
    }
    try{
      await updateEmployeeBankingInDB(user.id,form);
      setData(d=>({...d,users:d.users.map(u=>u.id===user.id?{...u,...form}:u)}));
      toast("Banking details saved!","success");
      setEditing(false);
    }catch(err){toast(`Error: ${err.message}`,"error");}
  };

  const rows=[["Bank",user.bankName],["Account Holder",user.accountHolder],["Account Number",user.accountNumber],["Branch Code",user.branchCode],["Account Type",user.accountType]];
  const hasDetails=!!user.accountNumber;

  return (
    <div className="fade-in" style={{maxWidth:560}}>
      <div style={{marginBottom:24}}>
        <h2 style={s.h2}>Banking Details</h2>
        <p style={{...s.sub,marginTop:4}}>Used by your employer to pay your salary. Kept private to you and your admin.</p>
      </div>
      <div style={s.card}>
        {!editing?(
          <>
            {hasDetails?rows.map(([l,v])=>(
              <div key={l} style={{...s.flex(0,"row","center"),justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
                <span style={s.sub}>{l}</span><span style={{fontSize:14,fontWeight:600}}>{v||"—"}</span>
              </div>
            )):(
              <p style={{...s.sub,textAlign:"center",padding:"24px 0"}}>No banking details on file yet.</p>
            )}
            <button onClick={()=>setEditing(true)} style={{...s.btn(),marginTop:16}}>{hasDetails?"Edit Details":"Add Banking Details"}</button>
          </>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><label style={s.label}>Bank Name *</label><input value={form.bankName} onChange={e=>setForm(f=>({...f,bankName:e.target.value}))} style={s.input} placeholder="e.g. FNB, Capitec, Standard Bank"/></div>
            <div><label style={s.label}>Account Holder *</label><input value={form.accountHolder} onChange={e=>setForm(f=>({...f,accountHolder:e.target.value}))} style={s.input}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label style={s.label}>Account Number *</label><input value={form.accountNumber} onChange={e=>setForm(f=>({...f,accountNumber:e.target.value.replace(/\D/g,"")}))} style={s.input} inputMode="numeric"/></div>
              <div><label style={s.label}>Branch Code *</label><input value={form.branchCode} onChange={e=>setForm(f=>({...f,branchCode:e.target.value.replace(/\D/g,"")}))} style={s.input} inputMode="numeric"/></div>
            </div>
            <div>
              <label style={s.label}>Account Type</label>
              <select value={form.accountType} onChange={e=>setForm(f=>({...f,accountType:e.target.value}))} style={s.input}>
                {["Cheque","Savings","Transmission"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end"}}>
              <button onClick={()=>setEditing(false)} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
              <button onClick={save} style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}>Save Details</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
 }

  
 // ─── ADMIN PAYSALARIES ─────────────
 function AdminPaySalaries({user,data,setData,toast}) {
  const now=new Date();
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const [selMonth,setSelMonth]=useState(months[now.getMonth()]);
  const [selYear, setSelYear] =useState(now.getFullYear());
  const [selected,setSelected]=useState([]);
  const [paying,  setPaying]  =useState(false);
  const [viewMode,setViewMode]=useState("byMonth"); // byMonth | byEmployee

  const employees=data.users.filter(u=>u.role==="employee"&&u.company===user.company);
  const payments =(data.payments||[]).filter(p=>employees.some(e=>e.id===p.userId));
  const getEmp   =id=>employees.find(e=>e.id===id);

  const paidThisPeriod=uid=>payments.some(p=>p.userId===uid&&p.month===selMonth&&p.year===selYear);
  const slipForPeriod =uid=>data.payslips.find(p=>p.userId===uid&&p.month===selMonth&&p.year===selYear);
  const latestSlip    =uid=>{
    const slips=data.payslips.filter(p=>p.userId===uid);
    if(!slips.length) return null;
    return [...slips].sort((a,b)=>(b.year-a.year)||(months.indexOf(b.month)-months.indexOf(a.month)))[0];
  };
  // Amount that will be paid: this period's payslip if it exists, else latest as template
  const amountFor=uid=>{const sp=slipForPeriod(uid);if(sp)return sp.netPay;const t=latestSlip(uid);return t?t.netPay:null;};

  const toggleSel=uid=>setSelected(s=>s.includes(uid)?s.filter(x=>x!==uid):[...s,uid]);

  const paySelected=async()=>{
    if(!selected.length){toast("Select at least one employee.","error");return;}
    setPaying(true);
    let ok=0; const skipped=[];
    for(const uid of selected){
      const emp=getEmp(uid);
      if(paidThisPeriod(uid)){skipped.push(`${emp.name} — already paid`);continue;}
      try{
        // AUTOMATED PAYSLIP: use this period's payslip, or clone the latest one
        let slip=slipForPeriod(uid);
        if(!slip){
          const template=latestSlip(uid);
          if(!template){skipped.push(`${emp.name} — no payslip history, create one manually first`);continue;}
          slip={id:genId(),userId:uid,month:selMonth,year:selYear,
            basicSalary:template.basicSalary,allowances:template.allowances,
            deductions:template.deductions,netPay:template.netPay,
            issueDate:today(),downloaded:false};
          await createPayslipInDB(slip,user.company);
          setData(d=>({...d,payslips:[...d.payslips,slip]}));
        }
        const pay={id:genId(),userId:uid,month:selMonth,year:selYear,
          amount:slip.netPay,paymentDate:today(),
          reference:`SAL-${selMonth.slice(0,3).toUpperCase()}${selYear}-${(emp.name.split(" ")[0]||"EMP").toUpperCase()}`,
          status:"paid",payslipId:slip.id};
        await createPaymentInDB(pay,user.company);
        setData(d=>({...d,payments:[...(d.payments||[]),pay]}));
        ok++;
      }catch(err){skipped.push(`${emp.name} — ${err.message}`);}
    }
    setPaying(false); setSelected([]);
    if(ok)             toast(`${ok} payment${ok>1?"s":""} recorded for ${selMonth} ${selYear}. Payslips issued automatically.`,"success");
    if(skipped.length) toast(`Skipped: ${skipped.join("; ")}`,"error");
  };

  // Stats
  const periodPays=payments.filter(p=>p.month===selMonth&&p.year===selYear);
  const periodTotal=periodPays.reduce((sum,p)=>sum+p.amount,0);
  const allTimeTotal=payments.reduce((sum,p)=>sum+p.amount,0);
  const unpaidCount=employees.filter(e=>!paidThisPeriod(e.id)).length;

  // History groupings
  const byMonthGroups=(()=>{const g={};payments.forEach(p=>{const k=`${p.month} ${p.year}`;(g[k]=g[k]||[]).push(p);});
    return Object.entries(g).sort((a,b)=>{const[ma,ya]=a[0].split(" ");const[mb,yb]=b[0].split(" ");
      return (+yb - +ya)||(months.indexOf(mb)-months.indexOf(ma));});})();
  const byEmpGroups=employees.map(e=>({emp:e,pays:payments.filter(p=>p.userId===e.id)
    .sort((a,b)=>(b.year-a.year)||(months.indexOf(b.month)-months.indexOf(a.month)))})).filter(g=>g.pays.length);

  return (
    <div className="fade-in">
      {/* Stats */}
      <div style={{...s.flex(16,"row","stretch"),marginBottom:24,flexWrap:"wrap"}}>
        <StatCard label={`Paid — ${selMonth} ${selYear}`} value={`R${periodTotal.toFixed(2)}`} color={T.success} icon={<Icon.Money/>} sub={`${periodPays.length} employee${periodPays.length!==1?"s":""} paid`}/>
        <StatCard label="Unpaid This Period" value={unpaidCount} color={unpaidCount?T.warning:T.success} icon={<Icon.Clock/>}/>
        <StatCard label="Total Paid (All Time)" value={`R${allTimeTotal.toFixed(2)}`} color={T.accent} icon={<Icon.Stats/>} sub={`${payments.length} payments`}/>
      </div>

      {/* Pay panel */}
      <div style={{...s.card,marginBottom:24}}>
        <div style={{...s.flex(12,"row","center"),justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <h3 style={s.h3}>Pay Salaries</h3>
          <div style={{...s.flex(8,"row","center"),flexWrap:"wrap"}}>
            <select value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{...s.input,width:"auto"}}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select>
            <input type="number" value={selYear} onChange={e=>setSelYear(+e.target.value)} style={{...s.input,width:90}}/>
            <button onClick={()=>setSelected(employees.filter(e=>!paidThisPeriod(e.id)).map(e=>e.id))} style={s.btnSm("rgba(255,255,255,0.07)",T.white)}>Select All Unpaid</button>
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["","Employee","Banking","Amount (Net)","Status"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {employees.map((emp,i)=>{
                const paid=paidThisPeriod(emp.id), amt=amountFor(emp.id);
                return (
                  <tr key={emp.id} style={{background:i%2?"rgba(255,255,255,0.02)":"transparent",opacity:paid?0.55:1}}>
                    <td style={{padding:"10px 14px"}}>
                      <input type="checkbox" checked={selected.includes(emp.id)} disabled={paid} onChange={()=>toggleSel(emp.id)} style={{width:16,height:16,accentColor:T.accent}}/>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{fontSize:13,fontWeight:600}}>{emp.name}</div>
                      <div style={{...s.sub,fontSize:11}}>{emp.position||"—"}</div>
                    </td>
                    <td style={{padding:"10px 14px",fontSize:12,color:T.gray400}}>
                      {emp.accountNumber?`${emp.bankName} · ${emp.accountNumber} · ${emp.branchCode}`:<span style={{color:T.warning}}>No banking details</span>}
                    </td>
                    <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:amt!=null?T.success:T.warning}}>
                      {amt!=null?`R${amt.toFixed(2)}`:"No payslip history"}
                    </td>
                    <td style={{padding:"10px 14px"}}><span style={s.badge(paid?T.success:T.warning)}>{paid?"PAID":"UNPAID"}</span></td>
                  </tr>
                );
              })}
              {employees.length===0&&<tr><td colSpan={5} style={{padding:32,textAlign:"center",color:T.gray400}}>No employees.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{...s.flex(12,"row","center"),justifyContent:"space-between",marginTop:16,flexWrap:"wrap",gap:10}}>
          <p style={{...s.sub,fontSize:12,maxWidth:420}}>
            Recording a payment issues the {selMonth} payslip automatically (copied from each employee's latest payslip).
            Run the actual transfer via your bank's EFT using the banking details shown.
          </p>
          <button onClick={paySelected} disabled={paying||!selected.length} style={{...s.btn(T.success),opacity:paying||!selected.length?0.5:1,boxShadow:`0 4px 12px ${T.success}44`}}>
            {paying?"Recording…":`Record Payment — ${selected.length} selected`}
          </button>
        </div>
      </div>

      {/* History */}
      <div style={s.card}>
        <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <h3 style={s.h3}>Payment History</h3>
          <div style={{...s.flex(4,"row","center")}}>
            <button onClick={()=>setViewMode("byMonth")}    style={s.btnSm(viewMode==="byMonth"   ?T.accent:"rgba(255,255,255,0.07)",viewMode==="byMonth"   ?T.white:T.gray400)}>By Month</button>
            <button onClick={()=>setViewMode("byEmployee")} style={s.btnSm(viewMode==="byEmployee"?T.accent:"rgba(255,255,255,0.07)",viewMode==="byEmployee"?T.white:T.gray400)}>By Employee</button>
          </div>
        </div>

        {payments.length===0&&<p style={{...s.sub,textAlign:"center",padding:"24px 0"}}>No payments recorded yet.</p>}

        {viewMode==="byMonth"&&byMonthGroups.map(([period,pays])=>(
          <div key={period} style={{marginBottom:18}}>
            <div style={{...s.flex(10,"row","center"),justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid rgba(255,255,255,0.07)`,marginBottom:8}}>
              <span style={{fontWeight:700,fontSize:14}}>{period}</span>
              <span style={{...s.badge(T.success)}}>{pays.length} paid · R{pays.reduce((sm,p)=>sm+p.amount,0).toFixed(2)}</span>
            </div>
            {pays.map(p=>(
              <div key={p.id} style={{...s.flex(10,"row","center"),justifyContent:"space-between",padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:600}}>{getEmp(p.userId)?.name||"Unknown"}</span>
                <span style={{...s.sub,fontSize:12}}>{p.reference}</span>
                <span style={{...s.sub,fontSize:12}}>{fmtDate(p.paymentDate)}</span>
                <span style={{fontSize:13,fontWeight:700,color:T.success}}>R{p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ))}

        {viewMode==="byEmployee"&&byEmpGroups.map(({emp,pays})=>(
          <div key={emp.id} style={{marginBottom:18}}>
            <div style={{...s.flex(10,"row","center"),justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid rgba(255,255,255,0.07)`,marginBottom:8}}>
              <span style={{fontWeight:700,fontSize:14}}>{emp.name}</span>
              <span style={{...s.badge(T.accent)}}>{pays.length} payment{pays.length>1?"s":""} · R{pays.reduce((sm,p)=>sm+p.amount,0).toFixed(2)}</span>
            </div>
            {pays.map(p=>(
              <div key={p.id} style={{...s.flex(10,"row","center"),justifyContent:"space-between",padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:600}}>{p.month} {p.year}</span>
                <span style={{...s.sub,fontSize:12}}>{p.reference}</span>
                <span style={{...s.sub,fontSize:12}}>{fmtDate(p.paymentDate)}</span>
                <span style={{fontSize:13,fontWeight:700,color:T.success}}>R{p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
 }

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
 * checkDeviceLocation — improved version
 * Takes up to 3 GPS readings and uses the one with the best accuracy.
 * This handles the common case where the first GPS reading from a cold
 * start is inaccurate due to the device still locking onto satellites.
 *
 * status: 'approved' | 'out_of_range' | 'permission_denied' | 'unavailable' | 'no_office'
 */
const checkDeviceLocation = (officeLat, officeLng, radiusMeters=200) =>
new Promise(resolve => {
  if (officeLat==null||officeLng==null) return resolve({status:"no_office",distance:null});
  if (!navigator.geolocation)           return resolve({status:"unavailable",distance:null});

  const readings = [];
  let attempts   = 0;
  const MAX      = 5;

  const processReading = (pos) => {
    readings.push({
      lat:      pos.coords.latitude,
      lng:      pos.coords.longitude,
      accuracy: pos.coords.accuracy, // metres — lower is better
    });
    attempts++;

    if (attempts < MAX) {
      // Request another reading to build up a set
      navigator.geolocation.getCurrentPosition(processReading, finish,
        {enableHighAccuracy:true, timeout:6000, maximumAge:0});
    } else {
      finish();
    }
  };

  const finish = () => {
    if (readings.length === 0) {
      resolve({status:"permission_denied", distance:null});
      return;
    }
    // Pick the reading with the best (lowest) accuracy value
    const best = readings.reduce((a,b) => a.accuracy < b.accuracy ? a : b);
    const dist = haversineDistance(best.lat, best.lng, officeLat, officeLng);

    // If device accuracy itself is worse than radius, warn but still allow
    // (prevents false rejections when GPS signal is poor indoors)
    const effectiveRadius = Math.max(radiusMeters, best.accuracy * 0.8);

    resolve({
      status:   dist <= effectiveRadius ? "approved" : "out_of_range",
      distance: Math.round(dist),
      accuracy: Math.round(best.accuracy),
    });
  };

  // Start first reading
  navigator.geolocation.getCurrentPosition(processReading, finish,
    {enableHighAccuracy:true, timeout:8000, maximumAge:0});
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
   select option{background:#122954;color:#FFFFFF;}
   select{color:#FFFFFF;}
 `;
 
 // ─── STYLE PRIMITIVES ─────────────────────────────────────────────────────────
 const s = {
  flex:(g=0,d="row",a="center")=>({display:"flex",flexDirection:d,alignItems:a,gap:g}),
  card:{background:T.navyMid,borderRadius:8,padding:24,border:`1px solid rgba(255,255,255,0.06)`},
  h1:{fontSize:28,fontWeight:800,color:T.white,letterSpacing:-0.5},
  h2:{fontSize:20,fontWeight:700,color:T.white},
  h3:{fontSize:16,fontWeight:600,color:T.white},
  sub:{fontSize:13,color:T.gray400},
  btn:(bg=T.accent,fg=T.white)=>({
    background:bg,color:fg,border:"none",borderRadius:6,padding:"10px 20px",
    fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 0.2s",
    display:"inline-flex",alignItems:"center",gap:6,
  }),
  btnSm:(bg=T.accent,fg=T.white)=>({
    background:bg,color:fg,border:"none",borderRadius:4,padding:"6px 14px",
    fontWeight:600,fontSize:12,cursor:"pointer",transition:"all 0.2s",
    display:"inline-flex",alignItems:"center",gap:4,
  }),
  input:{
    width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid rgba(255,255,255,0.1)`,
    borderRadius:6,padding:"10px 14px",color:T.white,fontSize:14,outline:"none",
    transition:"border-color 0.2s",colorScheme:"dark",
  },
  label:{fontSize:13,fontWeight:600,color:T.gray400,marginBottom:6,display:"block"},
  badge:(color)=>({
    display:"inline-block",padding:"3px 10px",borderRadius:2,fontSize:12,fontWeight:600,
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
   Bank: ()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M4 10h16"/><path d="M5 6l7-3 7 3"/><path d="M5 10v11"/><path d="M19 10v11"/><path d="M9 14v3"/><path d="M15 14v3"/></svg>,
   Money:()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 10v.01"/><path d="M19 14v.01"/></svg>,
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
  return ReactDOM.createPortal(
    <div style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,
      zIndex:9999,
      background:"rgba(0,0,0,0.75)",
      overflowY:"auto",
      WebkitOverflowScrolling:"touch",
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:T.navyMid,
        borderRadius:20,
        width:"calc(100% - 32px)",
        maxWidth:width,
        border:`1px solid rgba(255,255,255,0.1)`,
        animation:"fadeIn 0.25s ease",
        margin:"16px auto 32px",
      }}>
        <div style={{
          ...s.flex(0,"row","center"),
          justifyContent:"space-between",
          padding:"20px 24px",
          borderBottom:`1px solid rgba(255,255,255,0.06)`,
        }}>
          <span style={s.h2}>{title}</span>
          <button onClick={onClose} style={{
            background:"rgba(255,255,255,0.06)",border:"none",
            borderRadius:8,width:32,height:32,color:T.white,fontSize:18,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>×</button>
        </div>
        <div style={{padding:24}}>{children}</div>
      </div>
    </div>,
    document.body
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
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
    Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),   // full-accuracy detector
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), // full-accuracy landmarks
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
      .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({minConfidence:0.5}))
      .withFaceLandmarks()
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
    const [mode,        setMode]        = useState("idle"); // idle | camera | preview
    const [preview,      setPreview]     = useState(null);
    const [camErr,       setCamErr]      = useState("");
    const [modelsReady,  setModelsReady] = useState(false);
    const [descriptors,  setDescriptors] = useState([]); // collected shots
    const REQUIRED_SHOTS = 3;
  
    // Load models once — same model set used during check-in for consistency
    useEffect(()=>{
      const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
      Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]).then(()=>setModelsReady(true))
        .catch(()=>setCamErr("Failed to load face models. Check your internet connection."));
    },[]);
  
    const stopCam = useCallback(()=>{
      if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
    },[]);
  
    useEffect(()=>{
      if(mode==="camera"&&videoRef.current&&streamRef.current)
        videoRef.current.srcObject=streamRef.current;
    },[mode]);
    useEffect(()=>()=>stopCam(),[]);
  
    const openCamera = async ()=>{
      if(!modelsReady){ setCamErr("Face models still loading, please wait a moment…"); return; }
      setCamErr("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}}});
        streamRef.current=stream; setMode("camera");
      } catch { setCamErr("Camera access denied. Please allow camera or upload a photo instead."); }
    };
  
    const extractDescriptor = async (source) => {
      const detection = await faceapi
        .detectSingleFace(source, new faceapi.SsdMobilenetv1Options({minConfidence:0.8}))
        .withFaceLandmarks()
        .withFaceDescriptor();
      return detection?.descriptor || null;
    };
  
    const capturePhoto = async ()=>{
      const video=videoRef.current, canvas=canvasRef.current;
      if(!video||!canvas) return;
      canvas.width=video.videoWidth||640; canvas.height=video.videoHeight||480;
      canvas.getContext("2d").drawImage(video,0,0);
      const base64=canvas.toDataURL("image/jpeg",0.85);
  
      setCamErr("");
      const descriptor = await extractDescriptor(video);
      if(!descriptor){
        setCamErr("No face detected in that shot. Ensure good lighting and try again.");
        return;
      }
      const updated = [...descriptors, descriptor];
      setDescriptors(updated);
      setPreview(base64);
  
      if(updated.length >= REQUIRED_SHOTS){
        finishEnrollment(updated, base64);
      }
    };
  
    // Averages all collected descriptors element-wise into one reference descriptor
    const finishEnrollment = (allDescriptors, base64Preview) => {
      const len = allDescriptors[0].length;
      const avg = new Float32Array(len);
      allDescriptors.forEach(d => { for(let i=0;i<len;i++) avg[i]+=d[i]; });
      for(let i=0;i<len;i++) avg[i]/=allDescriptors.length;
  
      stopCam();
      setMode("preview");
      onCapture?.(base64Preview, Array.from(avg));
    };
  
    const handleUpload = e=>{
      const file=e.target.files?.[0]; if(!file) return;
      if(!["image/jpeg","image/jpg","image/png","image/webp"].includes(file.type)){setCamErr("Only JPG, PNG or WEBP accepted.");return;}
      if(file.size>5*1024*1024){setCamErr("Image must be under 5 MB.");return;}
      if(!modelsReady){ setCamErr("Face models still loading, please wait a moment…"); return; }
  
      const reader=new FileReader();
      reader.onload=ev=>{
        const b64=ev.target.result;
        const img=new Image();
        img.onload=async ()=>{
          const descriptor = await extractDescriptor(img);
          if(!descriptor){
            setCamErr("No face detected in that photo. Please upload a clear front-facing photo.");
            return;
          }
          setCamErr("");
          setPreview(b64);
          setMode("preview");
          setDescriptors([descriptor]);
          onCapture?.(b64, Array.from(descriptor));
        };
        img.src=b64;
      };
      reader.readAsDataURL(file);
    };
  
    const reset = () => {
      stopCam();
      setMode("idle"); setPreview(null); setDescriptors([]); setCamErr("");
      if(fileInputRef.current) fileInputRef.current.value="";
      onClear?.();
    };
  
    return (
      <div style={{...s.card,background:"rgba(255,255,255,0.03)",border:`1px dashed rgba(255,255,255,0.12)`,padding:20,textAlign:"center"}}>
        <p style={{...s.sub,fontSize:12,fontWeight:700,marginBottom:14,textTransform:"uppercase",letterSpacing:0.8}}>
          Employee Face Registration
        </p>
  
        {mode==="idle"&&(
          <>
            {!modelsReady && (
              <div style={{...s.flex(8,"row","center"),justifyContent:"center",marginBottom:12}}>
                <span className="spin" style={{display:"inline-block",width:14,height:14,border:`2px solid rgba(255,255,255,0.2)`,borderTopColor:T.accentLight,borderRadius:"50%"}}/>
                <span style={{...s.sub,fontSize:12}}>Loading face recognition models…</span>
              </div>
            )}
            <div style={{...s.flex(10,"row","center"),justifyContent:"center",marginBottom:12}}>
              <button onClick={openCamera} disabled={!modelsReady} style={{...s.btn(T.accent),fontSize:13,padding:"9px 18px",borderRadius:10,opacity:modelsReady?1:0.5}}><Icon.Camera/>Open Camera</button>
              <button onClick={()=>fileInputRef.current?.click()} disabled={!modelsReady} style={{...s.btn("rgba(255,255,255,0.08)",T.white),fontSize:13,padding:"9px 18px",borderRadius:10,opacity:modelsReady?1:0.5}}>↑ Upload Photo</button>
            </div>
            <p style={{fontSize:11,color:T.gray400}}>Camera captures 3 shots for accuracy · JPG/PNG/WEBP max 5MB for upload</p>
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
              <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"6px",background:"rgba(0,0,0,0.6)",textAlign:"center",fontSize:11,fontWeight:700,color:T.accentLight,letterSpacing:0.8}}>
                SHOT {descriptors.length+1} OF {REQUIRED_SHOTS} — ALIGN FACE IN OVAL
              </div>
            </div>
            <canvas ref={canvasRef} style={{display:"none"}}/>
            <div style={{...s.flex(6,"row","center")}}>
              {Array(REQUIRED_SHOTS).fill(null).map((_,i)=>(
                <div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<descriptors.length?T.success:"rgba(255,255,255,0.2)"}}/>
              ))}
            </div>
            <div style={{...s.flex(10,"row","center")}}>
              <button onClick={capturePhoto} style={{...s.btn(T.success),fontSize:13,padding:"9px 20px",borderRadius:10,boxShadow:`0 4px 12px ${T.success}44`}}><Icon.Camera/>Capture Shot {descriptors.length+1}</button>
              <button onClick={reset} style={{...s.btn("rgba(255,255,255,0.07)",T.gray400),fontSize:13,padding:"9px 16px",borderRadius:10}}>Cancel</button>
            </div>
            {camErr&&<p style={{fontSize:12,color:T.danger}}>{camErr}</p>}
          </div>
        )}
  
        {mode==="preview"&&preview&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
            <div style={{position:"relative",display:"inline-block"}}>
              <img src={preview} alt="Face preview" style={{width:140,height:140,objectFit:"cover",borderRadius:12,border:`3px solid ${T.success}`,boxShadow:`0 0 20px ${T.success}44`}}/>
              <div style={{position:"absolute",bottom:-6,right:-6,width:28,height:28,borderRadius:"50%",background:T.success,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon.Check/></div>
            </div>
            <p style={{fontSize:13,fontWeight:700,color:T.success}}>✓ Face profile captured ({descriptors.length} shot{descriptors.length>1?"s":""} averaged)</p>
            <p style={{...s.sub,fontSize:11}}>Used for facial recognition during check-in.</p>
            <button onClick={reset} style={s.btnSm("rgba(255,255,255,0.07)",T.gray400)}>Retake</button>
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [isDesktop,   setIsDesktop]   = useState(window.innerWidth >= 768);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const dropRef = useRef(null);

  useEffect(()=>{
    const h = e => { if(dropRef.current && !dropRef.current.contains(e.target)) setProfileOpen(false); };
    const r = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if(desktop) setSidebarOpen(true);
    };
    document.addEventListener("mousedown", h);
    window.addEventListener("resize", r);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("resize", r);
    };
  },[]);

  return (
    <div style={{display:"flex",minHeight:"100vh",background:T.navy}}>
      <style>{globalCSS}</style>

      {/* Mobile overlay — dims background when sidebar is open on small screens */}
      {sidebarOpen && !isDesktop && (
        <div onClick={()=>setSidebarOpen(false)} style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:99
        }}/>
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width:240, background:T.navyMid,
        borderRight:`1px solid rgba(255,255,255,0.06)`,
        display:"flex", flexDirection:"column",
        position:"fixed", top:0, bottom:0, left:0, zIndex:100,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease",
      }}>
        {/* Logo */}
        <div style={{padding:"24px 20px",borderBottom:`1px solid rgba(255,255,255,0.06)`}}>
          <div style={{...s.flex(10,"row","center")}}>
            <div style={{
              width:38,height:38,borderRadius:10,
              background:`linear-gradient(135deg,${T.accent},${T.accentLight})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:18,fontWeight:900,flexShrink:0
            }}>W</div>
            <div>
              <div style={{fontWeight:800,fontSize:16,letterSpacing:-0.5}}>WorkMax</div>
              <div style={{...s.sub,fontSize:11}}>
                {user.role==="global_admin"?"Global Platform":user.role==="company_admin"?"Admin Panel":"Employee Portal"}
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{flex:1,padding:"16px 12px",overflowY:"auto"}}>
          {navItems.map(item=>{
            const active = activeNav === item.id;
            return (
              <button key={item.id}
                onClick={()=>{ setActiveNav(item.id); if(!isDesktop) setSidebarOpen(false); }}
                style={{
                  display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",
                  background: active ? `${T.accent}22` : "transparent",
                  color: active ? T.accentLight : T.gray400,
                  border: active ? `1px solid ${T.accent}33` : "1px solid transparent",
                  borderRadius:10, marginBottom:4, cursor:"pointer", textAlign:"left",
                  fontWeight: active ? 700 : 500, fontSize:14, transition:"all 0.15s",
                }}>
                <span style={{color: active ? T.accentLight : T.gray400}}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User info bottom */}
        <div style={{padding:"16px",borderTop:`1px solid rgba(255,255,255,0.06)`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            width:36,height:36,borderRadius:10,
            background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:14,fontWeight:700,flexShrink:0
          }}>{user.avatar}</div>
          <div style={{flex:1,overflow:"hidden"}}>
            <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
            <div style={{fontSize:11,color:T.gray400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.email}</div>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{marginLeft: isDesktop && sidebarOpen ? 240 : 0, flex:1, display:"flex", flexDirection:"column", transition:"margin-left 0.25s ease"}}>
        <header style={{
          background:T.navyMid, borderBottom:`1px solid rgba(255,255,255,0.06)`,
          padding:"0 16px", height:64,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          position:"sticky", top:0, zIndex:50,
        }}>
          {/* Left side: hamburger + page title */}
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1,overflow:"hidden"}}>
            <button onClick={()=>setSidebarOpen(v=>!v)} style={{
              background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8,
              width:36, height:36, color:T.white, fontSize:20, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
            }}>☰</button>
            <h1 style={{...s.h2,fontSize:16,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {navItems.find(n=>n.id===activeNav)?.label||""}
            </h1>
          </div>

          {/* Right side: profile dropdown (employees) or logout (admins) */}
          {user.role==="employee" && (
            <div ref={dropRef} style={{position:"relative"}}>
              <button onClick={()=>setProfileOpen(v=>!v)} style={{
                ...s.flex(8,"row","center"),
                background:"rgba(255,255,255,0.05)", border:`1px solid rgba(255,255,255,0.1)`,
                borderRadius:10, padding:"7px 14px", color:T.white, fontSize:14, fontWeight:600,
              }}>
                <div style={{
                  width:28, height:28, borderRadius:8,
                  background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:700,
                }}>{user.avatar}</div>
                {user.name.split(" ")[0]} ▾
              </button>
              {profileOpen && (
                <div style={{
                  position:"absolute", right:0, top:"calc(100% + 8px)",
                  background:T.navyMid, border:`1px solid rgba(255,255,255,0.1)`,
                  borderRadius:12, minWidth:180,
                  boxShadow:"0 8px 32px rgba(0,0,0,0.4)", overflow:"hidden",
                  animation:"fadeIn 0.15s ease",
                }}>
                  {[
                    {id:"profile", label:"My Profile", icon:<Icon.Profile/>},
                    {id:"stats",   label:"My Stats",   icon:<Icon.Stats/>},
                  ].map(item=>(
                    <button key={item.id}
                      onClick={()=>{ setActiveNav(item.id); setProfileOpen(false); }}
                      style={{
                        display:"flex", alignItems:"center", gap:10, width:"100%",
                        padding:"12px 16px", background:"none", border:"none",
                        color:T.white, cursor:"pointer", fontSize:14, textAlign:"left",
                      }}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      <span style={{color:T.gray400}}>{item.icon}</span>{item.label}
                    </button>
                  ))}
                  <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"4px 0"}}/>
                  <button onClick={onLogout}
                    style={{
                      display:"flex", alignItems:"center", gap:10, width:"100%",
                      padding:"12px 16px", background:"none", border:"none",
                      color:T.danger, cursor:"pointer", fontSize:14, textAlign:"left",
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,0.08)"}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <Icon.Logout/>Logout
                  </button>
                </div>
              )}
            </div>
          )}
          {user.role !== "employee" && (
            <button onClick={onLogout} style={{...s.btn("rgba(255,255,255,0.06)",T.gray400),fontSize:13}}>
              <Icon.Logout/>Logout
            </button>
          )}
        </header>

        {/* Page content */}
        <main style={{flex:1, padding:28, overflowY:"auto"}}>{children}</main>
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
   const [locationAccuracy, setLocationAccuracy] = useState(null);
   const [dayModal,      setDayModal]      = useState(null);
   const [faceOk,        setFaceOk]        = useState(false);
   const [checkDone,     setCheckDone]     = useState(false);
   // Geolocation state — populated automatically when modal opens
   const [locationStatus,  setLocationStatus]  = useState("idle");
   const [locationMetres,  setLocationMetres]  = useState(null);
 
   const todayStr       = today();
   const isBeforeCutoff = nowHour() < 24; // check-in window closes at 5pm midday
   const days           = daysInMonth(calYear,calMonth);
   const firstDay       = firstDayOfMonth(calYear,calMonth);
   const monthNames     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
 
   const getAttendance = dateStr => data.attendance.find(a=>a.userId===user.id&&a.date===dateStr);
 
   // Auto-check location the moment the modal opens
   useEffect(()=>{
     if(!dayModal) return;
     setLocationStatus("checking"); setLocationMetres(null);
     const company = data.companies.find(c=>c.id===user.company);
     checkDeviceLocation(company?.lat??null, company?.lng??null, company?.checkinRadius??150)
       .then(({status,distance,accuracy})=>{
         setLocationStatus(status);
         setLocationMetres(distance);
         setLocationAccuracy(accuracy??null);
      });
   },[dayModal]);
 
   // Check-in requires face AND location both approved
   const doCheckIn = async () => {
    if(!faceOk) return;
    const locPassed = locationStatus==="approved"||locationStatus==="no_office";
    if(!locPassed) return;
    const now    = new Date();
    const time   = now.toTimeString().slice(0,5);
    const status = now.getHours() < 9 ? "present" : "late"; // The start of late
    const rec  = {id:genId(),userId:user.id,date:todayStr,checkIn:time,checkOut:null,status,locationVerified:locationStatus==="approved"};
    await createAttendanceInDB(rec, user.company);   // save to database
    setData(d=>({...d,attendance:[...d.attendance,rec]}));
    setCheckDone(true);
    toast(`Check-in recorded at ${time}${status==="late"?" (late)":""}`,"success");
    setTimeout(()=>setDayModal(null),1500);
   };
 
   const todayAtt = getAttendance(todayStr);
 
   return (
     <div className="fade-in">
       <div style={{...s.flex(16,"row","stretch"),marginBottom:10,flexWrap:"wrap"}}>
         <StatCard label="Status Today"   value={todayAtt?"Present":"Absent"} color={todayAtt?T.success:T.danger} icon={<Icon.Check/>} sub={todayAtt?`In: ${todayAtt.checkIn}`:"Not checked in"}/>
         <StatCard label="This Month"     value={data.attendance.filter(a=>a.userId===user.id&&a.date.startsWith(`${calYear}-${String(calMonth+1).padStart(2,"0")}`)).length} color={T.accent} icon={<Icon.Clock/>} sub="days present"/>
         <StatCard label="Pending Leaves" value={data.leaves.filter(l=>l.userId===user.id&&l.status==="pending").length} color={T.warning} icon={<Icon.Leave/>} sub="awaiting approval"/>
       </div>
 
       {/* Calendar */}
       <div style={{...s.card, padding:8}}>
         <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:6}}>
           <button onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}} style={s.btnSm("rgba(255,255,255,0.07)",T.white)}>‹</button>
           <span style={{...s.h3,fontSize:18}}>{monthNames[calMonth]} {calYear}</span>
           <button onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}} style={s.btnSm("rgba(255,255,255,0.07)",T.white)}>›</button>
         </div>
         <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
             <div key={d} style={{textAlign:"center",...s.sub,fontSize:10,fontWeight:700,padding:"4px 0"}}>{d}</div>
            ))}
         </div>
         <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
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
                 style={{height:95,borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",
                  justifyContent:"center",background:bg,border,color:textColor,
                  cursor:isToday?"pointer":"default",transition:"all 0.15s",fontSize:12,fontWeight:isToday?800:500,position:"relative"}}>
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
               <p style={s.h3}>Time to clock in has already passed.</p>
               <p style={{...s.sub,marginTop:8}}>Check-in: {todayAtt.checkIn} · Auto checkout: 16:00</p>
             </div>
           ):(
             <>
               {!isBeforeCutoff&&(
                 <div style={{...s.badge(T.warning),fontSize:13,padding:"10px 16px",marginBottom:20,display:"block",textAlign:"center"}}>
                   ⚠ Check-in window closed at 12:00 AM
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
                           {locationStatus==="approved" && `✓ Within office radius (${locationMetres}m away${locationAccuracy!=null?`, GPS ±${locationAccuracy}m`:""})`}
                           {locationStatus==="out_of_range" && `✕ ${locationMetres}m from office — need to be within ${data.companies.find(c=>c.id===user.company)?.checkinRadius||150}m`}
                           {locationStatus==="permission_denied"&&"✕ Location permission denied — enable in browser settings"}
                           {locationStatus==="unavailable"      &&"✕ Geolocation not supported on this device"}
                           {locationStatus==="no_office"        &&"⚠ No office coordinates configured — location check skipped"}
                           {locationStatus!=="idle" && locationStatus!=="checking" && (
                           <div style={{...s.sub, fontSize:10, marginTop:4, opacity:0.6, fontFamily:"monospace"}}>
                             Office: {data.companies.find(c=>c.id===user.company)?.lat}, {data.companies.find(c=>c.id===user.company)?.lng}
                           </div>
                           )}
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
                   <FaceScanner
                      registeredDescriptor={user.faceDescriptor}
                      onApproved={()=>setFaceOk(true)}
                      onDenied={()=>toast("Face not recognized. Please try again.","error")}
                    />
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
   const submit = async () => {
    if(!form.startDate||!form.endDate||!form.reason.trim()){toast("Please fill all fields.","error");return;}
    if(form.startDate>form.endDate){toast("Start date must be before end date.","error");return;}
    const entry={id:genId(),userId:user.id,...form,status:"pending",adminComment:null,reviewedBy:null};
    try {
      await createLeaveInDB(entry, user.company);
      setData(d=>({...d,leaves:[...d.leaves,entry]}));
      toast("Leave application submitted!","success");
      setShowForm(false); setForm({type:"Annual Leave",startDate:"",endDate:"",reason:""});
    } catch(err) {
      toast(`Error submitting leave: ${err.message}`,"error");
    }
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
   const months  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
   const mySlips  = data.payslips.filter(p=>p.userId===user.id&&p.year===currentYear)
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

  // Absent = stored absent rows (from the daily cron job) + computed absent
  // for any past workday that has no attendance record at all
  const countAbsentDays = () => {
    let count=0;
    const start=new Date((user.joinDate||today())+"T00:00:00");
    const end  =new Date(today()+"T00:00:00");
    if(isNaN(start.getTime())||isNaN(end.getTime())) return 0;
    for(let d=new Date(start); d<end; d.setDate(d.getDate()+1)){
      const day=d.getDay();
      if(day===0||day===6) continue;
      const ds=d.toISOString().split("T")[0];
      const has=att.some(a=>a.date===ds);
      if(!has) count++;
    }
    return count;
  };

  const absent = att.filter(a=>a.status==="absent").length + countAbsentDays();
  const total  = present+late+absent;
  const rate   = total?Math.round((present/total)*100):0;

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
   const [reregisterEmp,setReregisterEmp]=useState(null);
   // Added companyEmail and personalEmail fields
   const [form,setForm]=useState({name:"",email:"",companyEmail:"",personalEmail:"",password:"",department:"",position:"",phone:"",faceRegistered:false,faceImage:null,faceDescriptor:null});
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
      setForm({name:"",email:"",companyEmail:"",personalEmail:"",password:"",department:"",position:"",phone:"",faceRegistered:false,faceImage:null, faceDescriptor:null});
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

  const saveReregisteredFace = async (base64, descriptor) => {
    try {
      await updateEmployeeFaceInDB(reregisterEmp.id, base64, descriptor);
      setData(d=>({...d,users:d.users.map(u=>
        u.id===reregisterEmp.id
          ? {...u, faceRegistered:true, faceImage:base64, faceDescriptor:descriptor}
          : u
      )}));
      toast(`Face re-registered for ${reregisterEmp.name}!`,"success");
      setReregisterEmp(null);
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
         <Modal title="Add New Employee" onClose={()=>{setShowAdd(false);setForm({name:"",email:"",companyEmail:"",personalEmail:"",password:"",department:"",position:"",phone:"",faceRegistered:false,faceImage:null, faceDescriptor:null});}} width={560}>
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
              onCapture={(base64,descriptor)=>setForm(f=>({...f,faceRegistered:true,faceImage:base64,faceDescriptor:descriptor}))}
              onClear={()=>setForm(f=>({...f,faceRegistered:false,faceImage:null,faceDescriptor:null}))}
            />
             <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end",marginTop:4}}>
               <button onClick={()=>{setShowAdd(false);setForm({name:"",email:"",companyEmail:"",personalEmail:"",password:"",department:"",position:"",phone:"",faceRegistered:false,faceImage:null, faceDescriptor:null});}} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
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
            {[["Company Email",viewEmp.companyEmail||"—"],["Personal Email",viewEmp.personalEmail||"—"],["Department",viewEmp.department],["Position",viewEmp.position],["Phone",viewEmp.phone],["Join Date",fmtDate(viewEmp.joinDate)],["Status",viewEmp.blocked?"Blocked":"Active"]].map(([l,v])=>(
              <div key={l} style={{...s.flex(0,"row","center"),justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
                <span style={s.sub}>{l}</span><span style={{fontSize:14,fontWeight:600}}>{v}</span>
              </div>
            ))}
            <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
              <span style={s.sub}>Face ID</span>
              <div style={{...s.flex(8,"row","center")}}>
                <span style={s.badge(viewEmp.faceRegistered?T.success:T.warning)}>{viewEmp.faceRegistered?"Registered":"Pending"}</span>
                {viewEmp.faceRegistered&&!viewEmp.faceDescriptor&&(
                  <span style={s.badge(T.warning)}>Needs Upgrade</span>
                )}
              </div>
            </div>
            <button
              onClick={()=>{setReregisterEmp(viewEmp);setViewEmp(null);}}
              style={{...s.btn(T.accent),justifyContent:"center",marginTop:4}}>
              <Icon.Camera/>{viewEmp.faceRegistered?"Re-register Face":"Register Face"}
            </button>
          </div>
        </Modal>
      )}

      {reregisterEmp&&(
        <Modal title={`Re-register Face — ${reregisterEmp.name}`} onClose={()=>setReregisterEmp(null)} width={480}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:1.6}}>
              Capture a fresh set of face shots for <strong>{reregisterEmp.name}</strong>. This replaces their previous face profile — the old photo and descriptor will be discarded.
            </p>
            <FaceCapture
              onCapture={saveReregisteredFace}
              onClear={()=>{}}
            />
            <div style={{...s.flex(12,"row","center"),justifyContent:"flex-end"}}>
              <button onClick={()=>setReregisterEmp(null)} style={s.btn("rgba(255,255,255,0.07)",T.white)}>Cancel</button>
            </div>
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
 
   const review = async (decision) => {
    try {
      await updateLeaveInDB(reviewModal.id, decision, comment||null, user.id);
      setData(d=>({...d,leaves:d.leaves.map(l=>l.id===reviewModal.id?{...l,status:decision,adminComment:comment||null,reviewedBy:user.id}:l)}));
      toast(`Leave ${decision}!`,decision==="approved"?"success":"error");
      setReviewModal(null); setComment("");
    } catch(err) {
      toast(`Error: ${err.message}`,"error");
    }
   };
 
   // Group leaves by employee for the byEmployee view
   const leavesByEmployee = companyEmpIds.reduce((acc,empId)=>{
     const empLeaves = allLeaves.filter(l=>l.userId===empId).sort((a,b)=>b.startDate.localeCompare(a.startDate));
     if(empLeaves.length>0) acc.push({emp:getEmp(empId), leaves:empLeaves});
     return acc;
   },[]);
 
   
 
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
       {reviewModal && (
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
)}

     </div>
   );
 }
 
 // ─── ADMIN PAYSLIPS ───────────────────────────────────────────────────────────
 function AdminPayslips({user,data,setData,toast}) {
  const [editSlip, setEditSlip] = useState(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [viewMode, setViewMode] = useState("byEmployee"); // byEmployee | byMonth
  const [form,setForm] = useState({userId:"",month:"January",year:new Date().getFullYear(),basicSalary:"",allowances:"",deductions:""});

  const months      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const employees   = data.users.filter(u=>u.role==="employee"&&u.company===user.company);
  const companyEmpIds = employees.map(u=>u.id);
  const allSlips    = data.payslips
    .filter(p=>companyEmpIds.includes(p.userId))
    .sort((a,b)=>(b.year-a.year)||(months.indexOf(b.month)-months.indexOf(a.month)));
  const getEmp      = id=>data.users.find(u=>u.id===id);

  const resetForm   = () => setForm({userId:"",month:"January",year:new Date().getFullYear(),basicSalary:"",allowances:"",deductions:""});

  const saveSlip = async () => {
    const net = parseFloat(form.basicSalary||0)+parseFloat(form.allowances||0)-parseFloat(form.deductions||0);
    if(!form.userId){toast("Select an employee.","error");return;}
    try {
      if(editSlip){
        const updated = {...form,netPay:net,basicSalary:+form.basicSalary,allowances:+form.allowances,deductions:+form.deductions};
        await updatePayslipInDB(editSlip.id, updated);
        setData(d=>({...d,payslips:d.payslips.map(p=>p.id===editSlip.id?{...p,...updated}:p)}));
        toast("Payslip updated!","success");
      } else {
        const entry = {id:genId(),...form,basicSalary:+form.basicSalary,allowances:+form.allowances,deductions:+form.deductions,netPay:net,issueDate:today(),downloaded:false};
        await createPayslipInDB(entry, user.company);
        setData(d=>({...d,payslips:[...d.payslips,entry]}));
        toast("Payslip created!","success");
      }
      setEditSlip(null); setShowAdd(false); resetForm();
    } catch(err) {
      toast(`Error saving payslip: ${err.message}`,"error");
    }
  };

  // ── Group by employee ─────────────────────────────────────────────────────
  const byEmployeeGroups = employees.map(emp=>({
    emp,
    slips: allSlips.filter(p=>p.userId===emp.id),
  })).filter(g=>g.slips.length>0);

  // ── Group by month ────────────────────────────────────────────────────────
  const byMonthGroups = (()=>{
    const g={};
    allSlips.forEach(p=>{
      const key=`${p.month} ${p.year}`;
      (g[key]=g[key]||[]).push(p);
    });
    return Object.entries(g).sort((a,b)=>{
      const [ma,ya]=a[0].split(" "); const [mb,yb]=b[0].split(" ");
      return (+yb - +ya)||(months.indexOf(mb)-months.indexOf(ma));
    });
  })();

  // ── Shared payslip row renderer ───────────────────────────────────────────
  const SlipRow = ({p, showEmp=true}) => {
    const emp=getEmp(p.userId);
    return (
      <div style={{...s.flex(12,"row","center"),background:"rgba(255,255,255,0.03)",
        borderRadius:4,padding:"10px 14px",marginBottom:6,flexWrap:"wrap",gap:8}}>
        {showEmp&&(
          <div style={{minWidth:130}}>
            <div style={{fontSize:13,fontWeight:700}}>{emp?.name||"Unknown"}</div>
            <div style={{...s.sub,fontSize:11}}>{emp?.position||"—"}</div>
          </div>
        )}
        <div style={{...s.flex(20,"row","center"),flex:1,flexWrap:"wrap"}}>
          {!showEmp&&<span style={{fontSize:13,fontWeight:600,minWidth:120}}>{p.month} {p.year}</span>}
          {showEmp&&<span style={{...s.sub,fontSize:12,minWidth:100}}>{p.month} {p.year}</span>}
          <span style={{fontSize:13}}>Basic: <strong>R{p.basicSalary.toFixed(2)}</strong></span>
          <span style={{fontSize:13,color:T.success}}>+R{p.allowances.toFixed(2)}</span>
          <span style={{fontSize:13,color:T.danger}}>-R{p.deductions.toFixed(2)}</span>
          <span style={{fontSize:15,fontWeight:800,color:T.success}}>R{p.netPay.toFixed(2)}</span>
        </div>
        <button onClick={()=>{
          setEditSlip(p); setShowAdd(true);
          setForm({userId:p.userId,month:p.month,year:p.year,
            basicSalary:String(p.basicSalary),allowances:String(p.allowances),deductions:String(p.deductions)});
        }} style={s.btnSm(T.accent)}>Edit</button>
      </div>
    );
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={s.h2}>Payslips</h2>
          <p style={{...s.sub,marginTop:4}}>{allSlips.length} payslip{allSlips.length!==1?"s":""} issued</p>
        </div>
        <div style={{...s.flex(8,"row","center"),flexWrap:"wrap"}}>
          {/* View toggle */}
          <div style={{...s.flex(4,"row","center")}}>
            <button onClick={()=>setViewMode("byEmployee")} style={s.btnSm(viewMode==="byEmployee"?T.accent:"rgba(255,255,255,0.07)",viewMode==="byEmployee"?T.white:T.gray400)}>By Employee</button>
            <button onClick={()=>setViewMode("byMonth")}    style={s.btnSm(viewMode==="byMonth"   ?T.accent:"rgba(255,255,255,0.07)",viewMode==="byMonth"   ?T.white:T.gray400)}>By Month</button>
          </div>
          <button onClick={()=>{setShowAdd(true);setEditSlip(null);resetForm();}}
            style={{...s.btn(),boxShadow:`0 4px 12px ${T.accent}44`}}>
            <Icon.Plus/>New Payslip
          </button>
        </div>
      </div>

      {/* ── BY EMPLOYEE VIEW ──────────────────────────────────────────────── */}
      {viewMode==="byEmployee"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {byEmployeeGroups.length===0&&(
            <div style={{...s.card,textAlign:"center",padding:48,color:T.gray400}}>No payslips yet.</div>
          )}
          {byEmployeeGroups.map(({emp,slips})=>(
            <div key={emp.id} style={s.card}>
              {/* Employee header */}
              <div style={{...s.flex(12,"row","center"),marginBottom:12,paddingBottom:10,borderBottom:`1px solid rgba(255,255,255,0.07)`}}>
                <div style={{width:38,height:38,borderRadius:6,background:`linear-gradient(135deg,${T.accent},${T.navyLight})`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0}}>
                  {emp.avatar}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15}}>{emp.name}</div>
                  <div style={{...s.sub,fontSize:12}}>{emp.position} · {emp.department}</div>
                </div>
                <div style={{...s.flex(12,"row","center")}}>
                  <span style={s.badge(T.accent)}>{slips.length} payslip{slips.length!==1?"s":""}</span>
                  <span style={{fontSize:13,fontWeight:700,color:T.success}}>
                    Total: R{slips.reduce((sm,p)=>sm+p.netPay,0).toFixed(2)}
                  </span>
                </div>
              </div>
              {/* Slip rows */}
              {slips.map(p=><SlipRow key={p.id} p={p} showEmp={false}/>)}
            </div>
          ))}
        </div>
      )}

      {/* ── BY MONTH VIEW ─────────────────────────────────────────────────── */}
      {viewMode==="byMonth"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {byMonthGroups.length===0&&(
            <div style={{...s.card,textAlign:"center",padding:48,color:T.gray400}}>No payslips yet.</div>
          )}
          {byMonthGroups.map(([period,slips])=>(
            <div key={period} style={s.card}>
              {/* Month header */}
              <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",
                marginBottom:12,paddingBottom:10,borderBottom:`1px solid rgba(255,255,255,0.07)`}}>
                <span style={{fontWeight:700,fontSize:15}}>{period}</span>
                <div style={{...s.flex(12,"row","center")}}>
                  <span style={s.badge(T.accent)}>{slips.length} employee{slips.length!==1?"s":""}</span>
                  <span style={{fontSize:13,fontWeight:700,color:T.success}}>
                    Total: R{slips.reduce((sm,p)=>sm+p.netPay,0).toFixed(2)}
                  </span>
                </div>
              </div>
              {/* Slip rows */}
              {slips.map(p=><SlipRow key={p.id} p={p} showEmp={true}/>)}
            </div>
          ))}
        </div>
      )}

      {/* ── New / Edit Modal ──────────────────────────────────────────────── */}
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
                <div style={{fontSize:20,fontWeight:800,color:T.success}}>
                  R{((+form.basicSalary||0)+(+form.allowances||0)-(+form.deductions||0)).toFixed(2)}
                </div>
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

  // Computed absent for one employee: past workdays with no attendance record at all
  const absentForUser = (uid) => {
    const empRecs = data.attendance.filter(a=>a.userId===uid);
    const emp     = employees.find(e=>e.id===uid);
    let count=0;
    const start=new Date((emp?.joinDate||today())+"T00:00:00");
    const end  =new Date(today()+"T00:00:00");
    if(isNaN(start.getTime())||isNaN(end.getTime())) return 0;
    for(let d=new Date(start); d<end; d.setDate(d.getDate()+1)){
      const day=d.getDay();
      if(day===0||day===6) continue;
      const ds=d.toISOString().split("T")[0];
      if(!empRecs.some(a=>a.date===ds)) count++;
    }
    return count;
  };

  const present=relevantAtt.filter(a=>a.status==="present").length;
  const late   =relevantAtt.filter(a=>a.status==="late").length;
  const absent = selectedEmp==="all"
    ? relevantAtt.filter(a=>a.status==="absent").length + companyEmpIds.reduce((sum,uid)=>sum+absentForUser(uid),0)
    : relevantAtt.filter(a=>a.status==="absent").length + absentForUser(selectedEmp);
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
            <thead>
              <tr>{["Employee","Present","Late","Absent","Rate"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:12,fontWeight:700,color:T.gray400,borderBottom:`1px solid rgba(255,255,255,0.06)`}}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {employees.map((emp,i)=>{
                const ea=data.attendance.filter(a=>a.userId===emp.id);
                const ep=ea.filter(a=>a.status==="present").length;
                const el=ea.filter(a=>a.status==="late").length;
                const eab=absentForUser(emp.id);
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
        <>
          {/* ── Employee Calendar ── */}
          {(()=>{
            const emp      = data.users.find(u=>u.id===selectedEmp);
            const now      = new Date();
            const [calYear,  setCalYear]  = React.useState(now.getFullYear());
            const [calMonth, setCalMonth] = React.useState(now.getMonth());
            const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const days    = daysInMonth(calYear, calMonth);
            const firstDay= firstDayOfMonth(calYear, calMonth);
            const todayStr= today();
            const empAtt  = relevantAtt;

            return (
              <div style={{...s.card, marginBottom:16, padding:12}}>
                <div style={{...s.flex(0,"row","center"),justifyContent:"space-between",marginBottom:6}}>
                  <button onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}} style={s.btnSm("rgba(255,255,255,0.07)",T.white)}>‹</button>
                  <span style={{...s.h3,fontSize:15}}>{monthNames[calMonth]} {calYear} — {emp?.name}</span>
                  <button onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}} style={s.btnSm("rgba(255,255,255,0.07)",T.white)}>›</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
                    <div key={d} style={{textAlign:"center",color:T.gray400,fontSize:10,fontWeight:700,padding:"4px 0"}}>{d}</div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                  {Array(firstDay).fill(null).map((_,i)=><div key={"e"+i}/>)}
                  {Array(days).fill(null).map((_,i)=>{
                    const d       = i+1;
                    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                    const rec     = empAtt.find(a=>a.date===dateStr);
                    const isToday = dateStr===todayStr;
                    const isPast  = dateStr<todayStr;
                    const isWeekend=[0,6].includes(new Date(dateStr).getDay());
                    const status  = rec?.status || (isPast&&!isWeekend?"absent":null);
                    let bg="transparent",border="1px solid transparent",textColor=T.white;
                    if(isToday)              {bg=`${T.accent}33`;   border=`1px solid ${T.accent}`;}
                    else if(status==="present"){bg=`${T.success}22`; border=`1px solid ${T.success}33`;}
                    else if(status==="late")   {bg=`${T.warning}22`; border=`1px solid ${T.warning}33`;}
                    else if(status==="absent") {bg=`${T.danger}22`;  border=`1px solid ${T.danger}33`;}
                    else if(isWeekend)         {textColor=T.gray400;}
                    return (
                      <div key={d} style={{height:40,borderRadius:4,display:"flex",flexDirection:"column",alignItems:"center",
                        justifyContent:"center",background:bg,border,color:textColor,fontSize:11,fontWeight:isToday?800:500,position:"relative"}}>
                        {d}
                        {status&&<div style={{width:5,height:5,borderRadius:"50%",background:status==="present"?T.success:status==="late"?T.warning:T.danger,position:"absolute",bottom:3}}/>}
                      </div>
                    );
                  })}
                </div>
                <div style={{...s.flex(16,"row","center"),marginTop:8,flexWrap:"wrap"}}>
                  {[["Present",T.success],["Late",T.warning],["Absent",T.danger],["Today",T.accent]].map(([l,c])=>(
                    <div key={l} style={{...s.flex(6,"row","center")}}>
                      <div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{...s.sub,fontSize:11}}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Attendance Log Table ── */}
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
        </>
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
   const toggleBlock = async (u) => {
    const newBlocked = !u.blocked;
    try {
      // Choose the correct table based on the user's role
      if (u.role === 'employee') {
        await toggleBlockEmployeeInDB(u.id, newBlocked);
      } else {
        await toggleBlockAdminInDB(u.id, newBlocked);
      }
      // Update local state only after the DB write succeeds
      setData(d=>({...d,users:d.users.map(u2=>u2.id===u.id?{...u2,blocked:newBlocked}:u2)}));
      toast(newBlocked?`${u.name} blocked.`:`${u.name} unblocked.`, newBlocked?"error":"success");
    } catch(err) {
      toast(`Error: ${err.message}`,"error");
    }
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
      const isGlobal  = user.role === 'global_admin';
      const companyId = isGlobal ? null : user.company;
  
      const [dbAdmins, dbCompanies, dbEmployees, dbLeaves, dbAttendance, dbPayslips] =
        await Promise.all([
          fetchAdmins(),
          fetchCompanies(),
          isGlobal ? fetchAllEmployees()   : fetchEmployees(companyId),
          isGlobal ? fetchAllLeaves()      : fetchLeaves(companyId),
          isGlobal ? fetchAllAttendance()  : fetchAttendance(companyId),
          isGlobal ? fetchAllPayslips()    : fetchPayslips(companyId),
          isGlobal ? fetchAllPayments()   : fetchPayments(companyId),
        ]);
  
      setData({
        users:      [...dbAdmins, ...dbEmployees],
        companies:  dbCompanies.length > 0 ? dbCompanies : SEED.companies,
        leaves:     dbLeaves,
        attendance: dbAttendance,
        payslips:   dbPayslips,
        payments: dbPayments,
      });
    } catch (err) {
      console.warn('Supabase load failed:', err);
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
      {id:"banking",  label:"Banking Details", icon:<Icon.Bank/>},
      {id:"profile",  label:"Profile",       icon:<Icon.Profile/>},
      {id:"stats",    label:"My Stats",      icon:<Icon.Stats/>},
    ],
     company_admin:[
       {id:"employees",label:"Employees",     icon:<Icon.Users/>},
       {id:"leave",    label:"Leave",          icon:<Icon.Leave/>},
       {id:"payslips", label:"Payslips",       icon:<Icon.Payslip/>},
       {id:"stats",    label:"Statistics",     icon:<Icon.Stats/>},
       {id:"paysalaries", label:"Pay Salaries", icon:<Icon.Money/>},
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
       return {dashboard:<EmployeeDashboard {...p}/>,leave:<EmployeeLeave {...p}/>,payslips:<EmployeePayslips {...p}/>,profile:<EmployeeProfile {...p}/>,stats:<EmployeeStats {...p}/>, banking:<EmployeeBanking {...p}/>}[activeNav]||null;
     if(currentUser.role==="company_admin")
       return {employees:<AdminEmployees {...p}/>,leave:<AdminLeave {...p}/>,payslips:<AdminPayslips {...p}/>,stats:<AdminStats {...p}/>,password:<AdminPassword {...p}/>,paysalaries:<AdminPaySalaries {...p}/>}[activeNav]||null;
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
