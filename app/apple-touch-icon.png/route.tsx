import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div style={{width:"180px",height:"180px",display:"flex",position:"relative",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"linear-gradient(145deg,#252525 0%,#050505 62%,#111 100%)",borderRadius:"38px",fontFamily:"Arial, sans-serif"}}>
        <div style={{position:"absolute",left:"-35px",bottom:"-48px",width:"125px",height:"125px",borderRadius:"999px",background:"#f5f5f2",boxShadow:"inset -14px -12px 20px #999"}} />
        <div style={{position:"absolute",left:"20px",bottom:"18px",width:"75px",height:"8px",borderTop:"5px solid #b51620",borderRadius:"50%",transform:"rotate(48deg)"}} />
        <div style={{position:"absolute",right:"18px",bottom:"25px",display:"flex",alignItems:"flex-end",gap:"5px"}}>
          {[28,42,58,78].map((h,i)=><div key={i} style={{width:"10px",height:h+"px",background:"linear-gradient(#ddd,#555)",borderRadius:"2px"}} />)}
        </div>
        <div style={{position:"absolute",right:"12px",bottom:"78px",width:"82px",height:"42px",borderTop:"4px solid #d8d8d8",borderRadius:"50%",transform:"rotate(-25deg)",opacity:.85}} />
        <div style={{display:"flex",fontSize:"86px",fontWeight:900,letterSpacing:"-8px",color:"#e8e8e8",textShadow:"0 5px 3px #000, 0 0 2px #fff",transform:"translateY(-15px)"}}>YJ</div>
      </div>
    ),
    {width:180,height:180,headers:{"Cache-Control":"no-store, max-age=0"}}
  );
}
