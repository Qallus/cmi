/** All names, plans, quantities, dates, prices and bids here are synthetic demonstration data. */
export const SAMPLE_CSV=`Condition,Quantity,UOM,Cost Code,Material Unit Cost,Labor Unit Cost,Bid Area\nImported interior paint,2450,SF,09-900,0.62,1.25,Level 1\nImported baseboard,385,LF,06-200,2.8,1.9,Level 1\nImported doors,14,EA,08-100,345,125,Level 1\n`;
export function makeDemoJob(){
 return {id:'demo-cmi-26014',name:'Desert Ridge Residence',number:'CMI-26014',client:'Demonstration client',type:'Whole-home renovation',due:'Sep 25, 2026',status:'In progress',pricingMode:'markup',rate:18,contingency:5,tax:0,
  sheets:[{id:'a101',number:'A-101',name:'Ground floor plan',revision:'R02',width:1000,height:720,scale:.1,verified:true,demo:true},{id:'a102',number:'A-102',name:'Reflected ceiling plan',revision:'R01',width:1000,height:720,scale:.1,verified:true,demo:true},{id:'a201',number:'A-201',name:'Interior elevations',revision:'R01',width:1000,height:720,scale:.1,verified:true,demo:true}],
  items:[
   {id:'floor',name:'Porcelain tile · 24 × 48',code:'09-300',unit:'SF',kind:'area',color:'#688579',material:8.75,labor:6.4,waste:10,equipment:0,sub:0,taxable:true,baseQty:0,origin:'measured',area:'Great room + kitchen'},
   {id:'wood',name:'Engineered oak flooring',code:'09-640',unit:'SF',kind:'area',color:'#bd925d',material:9.25,labor:5.5,waste:8,equipment:0,sub:0,taxable:true,baseQty:0,origin:'measured',area:'Primary suite'},
   {id:'wall',name:'Interior partition · 10 ft',code:'09-210',unit:'LF',kind:'linear',color:'#7b90b9',material:24.5,labor:19.5,waste:5,equipment:0,sub:0,taxable:true,baseQty:0,origin:'measured',area:'Level 1'},
   {id:'door',name:'Solid-core interior doors',code:'08-100',unit:'EA',kind:'count',color:'#b77c70',material:445,labor:165,waste:0,equipment:0,sub:0,taxable:true,baseQty:0,origin:'measured',area:'Level 1'},
   {id:'cab',name:'Custom cabinetry',code:'06-410',unit:'LF',kind:'linear',color:'#9682a3',material:825,labor:115,waste:0,equipment:0,sub:0,taxable:true,baseQty:0,origin:'measured',area:'Kitchen'},
   {id:'concrete',name:'Exterior slab · 4 in',code:'03-300',unit:'CY',kind:'volume',depth:1/3,color:'#869fa3',material:205,labor:145,waste:5,equipment:25,sub:0,taxable:true,baseQty:0,origin:'measured',area:'Covered terrace'},
   {id:'electrical',name:'Electrical rough-in allowance',code:'26-000',unit:'EA',kind:'count',color:'#aa8b61',material:0,labor:0,waste:0,equipment:0,sub:9800,taxable:false,baseQty:1,origin:'manual',area:'Entire home'},
   {id:'plumbing',name:'Plumbing rough-in allowance',code:'22-000',unit:'EA',kind:'count',color:'#6f91a5',material:0,labor:0,waste:0,equipment:0,sub:11200,taxable:false,baseQty:1,origin:'manual',area:'Entire home'}
  ],
  geometry:[
   {id:'g1',sheetId:'a101',itemId:'floor',kind:'area',points:[{x:154,y:124},{x:510,y:124},{x:510,y:349},{x:154,y:349}]},
   {id:'g2',sheetId:'a101',itemId:'floor',kind:'area',points:[{x:154,y:361},{x:410,y:361},{x:410,y:552},{x:154,y:552}]},
   {id:'g3',sheetId:'a101',itemId:'wood',kind:'area',points:[{x:654,y:124},{x:820,y:124},{x:820,y:350},{x:654,y:350}]},
   {id:'g4',sheetId:'a101',itemId:'wall',kind:'linear',points:[{x:150,y:120},{x:825,y:120},{x:825,y:556},{x:150,y:556},{x:150,y:120}]},
   {id:'g5',sheetId:'a101',itemId:'wall',kind:'linear',points:[{x:518,y:120},{x:518,y:556}]},
   {id:'g6',sheetId:'a101',itemId:'door',kind:'count',points:[{x:510,y:300},{x:644,y:295},{x:640,y:470},{x:515,y:472},{x:575,y:550},{x:735,y:363}]},
   {id:'g7',sheetId:'a101',itemId:'cab',kind:'linear',points:[{x:172,y:535},{x:394,y:535},{x:394,y:384}]},
   {id:'g8',sheetId:'a101',itemId:'concrete',kind:'volume',points:[{x:156,y:580},{x:510,y:580},{x:510,y:648},{x:156,y:648}]}
  ],imports:[],activity:[{text:'Sample estimate opened. Nothing is connected to production.',at:'Local demo'}],selectedVendor:null
 };
}
export const ASSEMBLIES=[
 {id:'wall-system',name:'Interior partition',trade:'09 · Finishes',unit:'LF',desc:'Studs, track, gypsum board, insulation, finishing and installation.',material:24.5,labor:19.5,waste:5,components:[['Studs @ 16 in o.c.','0.75 EA / LF'],['Gypsum · both faces','20 SF / LF'],['Top + bottom track','2 LF / LF'],['Insulation','10 SF / LF']]},
 {id:'tile-system',name:'Large-format tile',trade:'09 · Finishes',unit:'SF',desc:'Porcelain, mortar, grout, leveling clips and installation.',material:8.75,labor:6.4,waste:10,components:[['Porcelain tile','1.10 SF / SF'],['Thinset mortar','0.02 BAG / SF'],['Grout','0.03 LB / SF'],['Installation labor','0.12 HR / SF']]},
 {id:'slab-system',name:'Concrete placement',trade:'03 · Concrete',unit:'CY',desc:'Ready-mix, placement and finishing. Rebar and formwork separate.',material:205,labor:145,waste:5,components:[['Ready-mix','1.05 CY / CY'],['Placement labor','2.75 HR / CY'],['Finishing','By exposed area'],['Reinforcing steel','Separate measured scope']]},
 {id:'door-system',name:'Interior door package',trade:'08 · Openings',unit:'EA',desc:'Solid-core slab, frame, hinges, lever set and installation.',material:445,labor:165,waste:0,components:[['Solid-core slab','1 EA / EA'],['Prehung frame','1 EA / EA'],['Hinge set','1 SET / EA'],['Lever set','1 EA / EA']]}
];
export const VENDORS=[
 {id:'a',name:'Demo vendor A',initials:'A',days:14,rows:[6200,3100,2200,null],notes:'Excludes disposal'},
 {id:'b',name:'Demo vendor B',initials:'B',days:10,rows:[6600,2950,2300,450],notes:'Complete scope'},
 {id:'c',name:'Demo vendor C',initials:'C',days:21,rows:[5800,3200,null,500],notes:'Excludes waterproofing'}
];
