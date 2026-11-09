(() => {
"use strict";

const $ = id => document.getElementById(id);
const state = {
  role: null, mode: "ptt", peers: new Map(), pendingHostPc: null,
  pendingJoinPc: null, localStream: null, scannerStream: null,
  scanTarget: null, scanFrame: null, speakerOn: true, micOn: true,
  talkActive: false
};

// No STUN/TURN server is configured: this deliberately targets same-LAN use.
// Browsers may use mDNS host candidates. Test on the actual devices/network.
const rtcConfig = { iceServers: [], bundlePolicy: "max-bundle" };
const ICE_TIMEOUT_MS = 18000;

function setStatus(message, good=false) {
  $("appStatus").textContent = message;
  $("appStatus").className = "pill " + (good ? "good" : "muted");
}
function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function deviceName() { return $("deviceName").value.trim() || "Unnamed device"; }
function safeText(s) { return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

$("saveNameBtn").onclick = () => { localStorage.setItem("wt-name", deviceName()); alert("Device name saved on this device."); };
const savedName = localStorage.getItem("wt-name"); if(savedName) $("deviceName").value=savedName;

function waitIceComplete(pc) {
  return new Promise((resolve,reject) => {
    if(pc.iceGatheringState==="complete") return resolve();
    const timer=setTimeout(()=>reject(new Error("ICE gathering timed out. Try again on the same Wi-Fi.")),ICE_TIMEOUT_MS);
    const handler=()=>{ if(pc.iceGatheringState==="complete"){clearTimeout(timer);pc.removeEventListener("icegatheringstatechange",handler);resolve();}};
    pc.addEventListener("icegatheringstatechange",handler);
  });
}
function encodeSignal(obj) {
  const compact = { t: obj.type, s: obj.sdp };
  if(obj.from) compact.f = obj.from;
  if(obj.version) compact.v = obj.version;
  return JSON.stringify(compact);
}
function parseSignal(value, expected) {
  let data; try { data=JSON.parse(value); } catch { throw new Error("That is not valid JSON. Paste the complete connection text."); }
  const type = data.type ?? data.t;
  const sdp = data.sdp ?? data.s;
  if(!data || type!==expected || !sdp) throw new Error("Expected a valid "+expected+" connection description.");
  return { ...data, type, sdp, from: data.from ?? data.f, version: data.version ?? data.v ?? 1 };
}
function makeQr(containerId, text) {
  const el=$(containerId); el.innerHTML="";
  if(typeof QRCode==="undefined"){el.textContent="QR library unavailable. Use Copy instead.";return;}
  if(text.length > 1800){
    el.textContent="This connection payload is large. Use Copy/Download JSON for best reliability on mobile.";
    return;
  }
  new QRCode(el,{text,width:260,height:260,correctLevel:QRCode.CorrectLevel.H});
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); alert("Copied."); }
  catch { alert("Copy is unavailable. Select the text and copy it manually."); }
}
function downloadJson(name,text) {
  const a=document.createElement("a"),url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
  a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
function ensureSecureMic() {
  if(!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access requires HTTPS (GitHub Pages is HTTPS) or localhost, and a supported browser.");
}
async function getMic() {
  ensureSecureMic();
  if(!state.localStream) state.localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  state.localStream.getAudioTracks().forEach(t=>t.enabled=state.micOn && state.mode==="duplex");
  return state.localStream;
}
function attachRemoteAudio(peer) {
  if(!peer.audio) {
    peer.audio=new Audio(); peer.audio.autoplay=true; peer.audio.playsInline=true;
    peer.audio.muted=!state.speakerOn; peer.audio.srcObject=peer.remoteStream;
    peer.audio.play().catch(()=>{ $("audioStatus").textContent="Tap the page once to allow audio playback."; });
  }
}
function addPeer(pc,name,role) {
  const id=crypto.randomUUID();
  const peer={id,pc,name:name||"Participant",role,remoteStream:new MediaStream(),audio:null};
  state.peers.set(id,peer);
  pc.ontrack=e=>{
    e.streams[0]?.getTracks().forEach(t=>peer.remoteStream.addTrack(t));
    if(e.track && !peer.remoteStream.getTracks().includes(e.track)) peer.remoteStream.addTrack(e.track);
    attachRemoteAudio(peer);
  };
  pc.onconnectionstatechange=()=>{ 
    if(["failed","closed","disconnected"].includes(pc.connectionState)){ 
      if(pc.connectionState!=="disconnected") removePeer(id);
      renderPeers();
    } else renderPeers();
  };
  pc.oniceconnectionstatechange=renderPeers;
  renderPeers(); updateAudioControls(); return peer;
}
function removePeer(id) {
  const p=state.peers.get(id); if(!p)return;
  try{p.pc.close();}catch{}
  if(p.audio){p.audio.pause();p.audio.srcObject=null;}
  state.peers.delete(id);renderPeers();updateAudioControls();
}
function renderPeers() {
  const list=$("participants");list.innerHTML="";
  const peers=[...state.peers.values()];
  $("participantCount").textContent=peers.length+" peer"+(peers.length===1?"":"s")+" · "+peers.filter(p=>p.pc.connectionState==="connected").length+" connected";
  if(!peers.length){list.innerHTML='<li class="empty">No participants connected yet.</li>';return;}
  peers.forEach(p=>{
    const li=document.createElement("li");
    const left=document.createElement("span");left.textContent=p.name;
    const right=document.createElement("span");right.className="hint";right.textContent=p.pc.connectionState;
    li.append(left,right);list.append(li);
  });
}
function updateAudioControls() {
  const connected=[...state.peers.values()].some(p=>p.pc.connectionState==="connected");
  const canUseTalk=connected && (state.mode==="ptt" || state.mode==="toggle");
  $("talkBtn").disabled=!canUseTalk;
  $("muteBtn").disabled=!connected;
  $("disconnectBtn").disabled=state.peers.size===0;
  if(state.mode==="ptt") $("audioStatus").textContent=connected?"Hold the button to send audio.":"Connect at least one peer to start.";
  else if(state.mode==="toggle") $("audioStatus").textContent=connected?"Click the microphone to start or stop transmission.":"Connect at least one peer to start.";
  else $("audioStatus").textContent=connected?"Microphone is open for two-way audio.":"Connect at least one peer to start.";
  if(state.mode==="duplex" && connected) activateDuplex().catch(e=>alert(e.message));
  if(state.mode!=="duplex" && !state.talkActive && state.localStream) state.localStream.getAudioTracks().forEach(t=>t.enabled=false);
  const label = state.mode==="toggle" ? (state.talkActive?"TRANSMITTING":"TOGGLE TALK") : (state.talkActive?"TRANSMITTING":"HOLD TO TALK");
  const hint = state.mode==="toggle" ? (state.talkActive?"Click to stop":"Click to start") : "Release to stop";
  $("talkBtn").querySelector("strong").textContent=label;
  $("talkBtn").querySelector("small").textContent=hint;
}
async function activateDuplex() {
  const stream=await getMic();
  stream.getAudioTracks().forEach(t=>t.enabled=state.micOn);
  for(const p of state.peers.values()){
    const sender=p.pc.getSenders().find(s=>s.track?.kind==="audio");
    if(sender && sender.track!==stream.getAudioTracks()[0]) await sender.replaceTrack(stream.getAudioTracks()[0]);
    else if(!sender) p.pc.addTrack(stream.getAudioTracks()[0],stream);
  }
}
function setMode(mode) {
  state.mode=mode;
  state.talkActive=false;
  $("pttModeBtn").classList.toggle("selected",mode==="ptt");
  $("duplexModeBtn").classList.toggle("selected",mode==="duplex");
  $("toggleModeBtn").classList.toggle("selected",mode==="toggle");
  $("talkBtn").classList.remove("active");
  if(state.mode==="duplex"){
    if(state.localStream) state.localStream.getAudioTracks().forEach(t=>t.enabled=state.micOn);
    activateDuplex().catch(e=>alert(e.message));
    $("audioStatus").textContent="Two-way mode: microphone is open while connected.";
  } else {
    state.localStream?.getAudioTracks().forEach(t=>t.enabled=false);
    $("audioStatus").textContent=mode==="ptt"?"Hold the button to send audio.":"Click the microphone to start or stop transmission.";
  }
  updateAudioControls();
}
$("pttModeBtn").onclick=()=>setMode("ptt");
$("duplexModeBtn").onclick=()=>setMode("duplex");
$("toggleModeBtn").onclick=()=>setMode("toggle");

async function startTalking() {
  const connected=[...state.peers.values()].some(p=>p.pc.connectionState==="connected");
  if(!connected || (state.mode!=="ptt" && state.mode!=="toggle"))return;
  try{
    const stream=await getMic(),track=stream.getAudioTracks()[0];track.enabled=state.micOn;
    for(const p of state.peers.values()){
      if(p.pc.connectionState==="connected"){
        let sender=p.pc.getSenders().find(s=>s.track?.kind==="audio");
        if(sender) await sender.replaceTrack(track); else p.pc.addTrack(track,stream);
      }
    }
    state.talkActive=true;track.enabled=state.micOn;
    $("talkBtn").classList.add("active");
    $("audioStatus").textContent="You are transmitting.";
    updateAudioControls();
  }catch(e){alert(e.message);}
}
function stopTalking() {
  if(state.mode==="duplex") return;
  state.talkActive=false;
  state.localStream?.getAudioTracks().forEach(t=>t.enabled=false);
  $("talkBtn").classList.remove("active");
  $("audioStatus").textContent="Transmission stopped.";
  updateAudioControls();
}
const talk=$("talkBtn");
talk.addEventListener("pointerdown",e=>{e.preventDefault();if(state.mode!=="ptt")return;talk.setPointerCapture?.(e.pointerId);startTalking();});
["pointerup","pointercancel","lostpointercapture"].forEach(ev=>talk.addEventListener(ev,()=>{if(state.mode==="ptt") stopTalking();}));
talk.addEventListener("click",async()=>{
  if(state.mode!=="toggle") return;
  if(state.talkActive) stopTalking(); else await startTalking();
});
talk.addEventListener("contextmenu",e=>e.preventDefault());

$("micEnabled").onchange=e=>{
  state.micOn=e.target.checked;
  if(state.mode==="duplex" || state.talkActive) state.localStream?.getAudioTracks().forEach(t=>t.enabled=state.micOn);
};
$("speakerEnabled").onchange=e=>{state.speakerOn=e.target.checked;for(const p of state.peers.values())if(p.audio)p.audio.muted=!state.speakerOn;};
$("muteBtn").onclick=()=>{$("speakerEnabled").checked=!$("speakerEnabled").checked;$("speakerEnabled").dispatchEvent(new Event("change"));$("muteBtn").textContent=state.speakerOn?"Mute speaker":"Unmute speaker";};

$("hostBtn").onclick=()=>{state.role="host";show("hostPanel");hide("joinPanel");setStatus("Host mode");};
$("joinBtn").onclick=()=>{state.role="join";show("joinPanel");hide("hostPanel");setStatus("Join mode");};

$("makeOfferBtn").onclick=async()=>{
  try{
    const pc=new RTCPeerConnection(rtcConfig);
    // Reserve audio transceiver so the remote peer can send audio back.
    pc.addTransceiver("audio",{direction:"sendrecv"});
    const peer=addPeer(pc,"Joining device","host");
    state.pendingHostPc=pc;state.pendingHostPeer=peer;
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);
    $("offerState").textContent="Gathering local network candidates…";
    await waitIceComplete(pc);
    const text=encodeSignal({type:"offer",sdp:pc.localDescription.sdp,from:deviceName(),version:1});
    $("offerText").value=text;makeQr("offerQr",text);show("offerArea");
    $("offerState").textContent="Invitation ready. Share it with ONE joining device. Create a separate invitation for each additional device.";
  }catch(e){alert(e.message);}
};
$("copyOfferBtn").onclick=()=>copyText($("offerText").value);
$("downloadOfferBtn").onclick=()=>downloadJson("walkie-offer.json",$("offerText").value);
$("applyAnswerBtn").onclick=async()=>{
  try{
    if(!state.pendingHostPc)throw new Error("Create an invitation first.");
    if(state.pendingHostPc.remoteDescription) throw new Error("This connection already has a remote description. Create a fresh invitation for a new device.");
    if(state.pendingHostPc.signalingState !== "have-local-offer") throw new Error("This invitation is not ready to receive an answer yet. Create a new offer and try again.");
    const answer=parseSignal($("answerText").value,"answer");
    await state.pendingHostPc.setRemoteDescription(answer);
    if(state.pendingHostPeer && answer.from)state.pendingHostPeer.name=answer.from;
    state.pendingHostPc=null;state.pendingHostPeer=null;
    $("answerText").value="";
    setStatus("Answer applied");renderPeers();
  }catch(e){alert(e.message);}
};

$("createAnswerBtn").onclick=async()=>{
  try{
    const offer=parseSignal($("joinOfferText").value,"offer");
    const pc=new RTCPeerConnection(rtcConfig);
    pc.addTransceiver("audio",{direction:"sendrecv"});
    const peer=addPeer(pc,offer.from||"Host","join");
    state.pendingJoinPc=pc;state.pendingJoinPeer=peer;
    if(pc.remoteDescription) throw new Error("This joining device is already connected. Start a new offer from the host.");
    await pc.setRemoteDescription(offer);
    const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
    $("answerState").textContent="Gathering local network candidates…";
    await waitIceComplete(pc);
    const text=encodeSignal({type:"answer",sdp:pc.localDescription.sdp,from:deviceName(),version:1});
    $("generatedAnswer").value=text;makeQr("answerQr",text);show("answerArea");
    $("answerState").textContent="Send this answer back to the host.";
    setStatus("Answer created");
  }catch(e){alert(e.message);}
};
$("copyAnswerBtn").onclick=()=>copyText($("generatedAnswer").value);
$("downloadAnswerBtn").onclick=()=>downloadJson("walkie-answer.json",$("generatedAnswer").value);

async function startScanner(target) {
  state.scanTarget=target;
  try{
    if(!window.isSecureContext) throw new Error("Camera scanning requires HTTPS or localhost. Run the app via a local server or GitHub Pages.");
    if(!navigator.mediaDevices?.getUserMedia) throw new Error("Camera requires HTTPS and a supported browser.");
    if(typeof jsQR === "undefined") throw new Error("The QR scanner library did not load. Refresh the page or check your internet connection.");
    state.scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
    $("scanVideo").srcObject=state.scannerStream;await $("scanVideo").play();
    show("scanPanel");$("scanStatus").textContent="Point the camera at the connection QR code.";
    scanLoop();
  }catch(e){alert(e.message);}
}
function scanLoop(){
  if(!state.scannerStream)return;
  const video=$("scanVideo"),canvas=$("scanCanvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(video.readyState>=2){
    canvas.width=video.videoWidth;canvas.height=video.videoHeight;ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const img=ctx.getImageData(0,0,canvas.width,canvas.height);
    if(typeof jsQR!=="undefined"){
      const code=jsQR(img.data,img.width,img.height,{inversionAttempts:"attemptBoth"});
      if(code?.data){
        if(state.scanTarget==="offer")$("joinOfferText").value=code.data;else $("answerText").value=code.data;
        stopScanner();$("scanStatus").textContent="QR scanned.";
        return;
      }
    }
  }
  state.scanFrame=requestAnimationFrame(scanLoop);
}
function stopScanner(){
  if(state.scanFrame)cancelAnimationFrame(state.scanFrame);
  state.scannerStream?.getTracks().forEach(t=>t.stop());state.scannerStream=null;
  $("scanVideo").srcObject=null;hide("scanPanel");
}
$("scanOfferBtn").onclick=()=>startScanner("offer");
$("scanAnswerBtn").onclick=()=>startScanner("answer");
$("stopScanBtn").onclick=stopScanner;

$("disconnectBtn").onclick=()=>{
  stopTalking();stopScanner();
  for(const id of [...state.peers.keys()])removePeer(id);
  state.pendingHostPc=null;state.pendingJoinPc=null;
  state.localStream?.getTracks().forEach(t=>t.stop());state.localStream=null;
  setStatus("Disconnected");updateAudioControls();
};

window.addEventListener("beforeunload",()=>{
  stopScanner();state.localStream?.getTracks().forEach(t=>t.stop());
  for(const p of state.peers.values())p.pc.close();
});

// Browsers need a user gesture before remote audio playback is always allowed.
document.addEventListener("pointerdown",()=>{for(const p of state.peers.values())p.audio?.play().catch(()=>{});},{once:true});

if(!window.isSecureContext) {
  $("audioStatus").textContent="Warning: this page is not a secure context. Use its HTTPS GitHub Pages URL or a localhost server for microphone/camera access.";
  $("scanStatus").textContent="Camera scanning requires HTTPS or localhost.";
}
setStatus("Ready");
})();