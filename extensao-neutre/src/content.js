/* content.js - Neutralizador PT-BR (v3) 
   Funcionalidades:
   - Aplica regras do arquivo /rules/rules.json (embutido no bundle)
   - Detecta páginas biográficas (Wikipédia) e bloqueia se infobox indicar gênero
   - Loga ações em chrome.storage e envia mensagens para o popup
   - Gera sugestões simples de regras quando encontra padrões recorrentes não modificados
*/

const SETTINGS_KEY = 'ativo';
const STATUS_KEY = 'neutralizador_status';
let isActive = true;
let observer = null;

// carregamos regras embutidas (copiadas do rules.json)
const RULES = JSON.parse(`{"meta": "Conjunto inicial de regras baseado no Guia Ophelia Cassiano. Edite /rules/rules.json para ajustar.", "exceptions": ["pessoa", "estudante", "cliente", "artista", "jovem", "participante", "ser", "individuo", "indivíduo"], "mappings": [{"from_regex": "\\b(ele)\\b", "to": "elu", "flags": "gi"}, {"from_regex": "\\b(ela)\\b", "to": "elu", "flags": "gi"}, {"from_regex": "\\b(dele)\\b", "to": "delu", "flags": "gi"}, {"from_regex": "\\b(dela)\\b", "to": "delu", "flags": "gi"}, {"from_regex": "\\b(eles)\\b", "to": "elus", "flags": "gi"}, {"from_regex": "\\b(elas)\\b", "to": "elus", "flags": "gi"}, {"from_regex": "\\b(aquele)\\b", "to": "aquelu", "flags": "gi"}, {"from_regex": "\\b(aquela)\\b", "to": "aquelu", "flags": "gi"}, {"from_regex": "\\bo\\s+aluno\\b", "to": "ê alune", "flags": "gi"}, {"from_regex": "\\ba\\s+aluna\\b", "to": "ê alune", "flags": "gi"}, {"from_regex": "\\b(amigo)\\b", "to": "amigue", "flags": "gi"}, {"from_regex": "\\b(amiga)\\b", "to": "amigue", "flags": "gi"}, {"from_regex": "\\b(aluno)\\b", "to": "alune", "flags": "gi"}, {"from_regex": "\\b(aluna)\\b", "to": "alune", "flags": "gi"}, {"from_regex": "\\b(todos)\\b", "to": "todes", "flags": "gi"}, {"from_regex": "\\b(todas)\\b", "to": "todes", "flags": "gi"}, {"from_regex": "\\b(o)\\b", "to": "e", "flags": "gi"}, {"from_regex": "\\b(a)\\b", "to": "e", "flags": "gi"}, {"from_regex": "\\b(os)\\b", "to": "es", "flags": "gi"}, {"from_regex": "\\b(as)\\b", "to": "es", "flags": "gi"}]}`);
const EXCEPTIONS = new Set(RULES.exceptions || []);
const MAPPINGS = (RULES.mappings || []).map(m => ({ r: new RegExp(m.from_regex, m.flags || 'g'), to: m.to }));

function setStatus(obj){
  try{
    window.__neutralizador_status = obj;
    if(chrome && chrome.storage && chrome.storage.local){
      chrome.storage.local.set({[STATUS_KEY]: obj}, ()=>{});
    }
  }catch(e){ console.error('setStatus', e); }
}

function isEditableNode(node){
  if(!node || !node.parentElement) return true;
  const tag = node.parentElement.tagName;
  if(['INPUT','TEXTAREA','SELECT','OPTION','CODE','PRE'].includes(tag)) return true;
  if(node.parentElement.isContentEditable) return true;
  return false;
}

function shouldBlockByPage(){
  try{
    const infobox = document.querySelector('.infobox, .infobox_v2, table.infobox');
    let text = '';
    if(infobox) text += infobox.innerText.toLowerCase();
    text += '\n' + (document.body ? document.body.innerText.slice(0,4000).toLowerCase() : '');
    const blockers = ['travesti','mulher','homem','feminino','masculino','cisgênero','cisgenero'];
    for(const b of blockers){ if(text.indexOf(b) !== -1) return {type:'block', reason:b}; }
    const allows = ['não-binário','não binário','não binarie','nao binario','nb','não-binar','não binar'];
    for(const a of allows){ if(text.indexOf(a) !== -1) return {type:'allow', reason:a}; }
    return {type:'unknown'};
  }catch(e){
    return {type:'unknown', error:String(e)};
  }
}

function applyMappingsToText(txt){
  let t = txt;
  for(const map of MAPPINGS){
    try{
      // skip replacements when token is in exceptions
      t = t.replace(map.r, function(match){
        // check token for exception (strip punctuation)
        const token = match.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
        if(EXCEPTIONS.has(token)) return match;
        // preserve capitalization pattern
        if(match === match.toUpperCase()) return map.to.toUpperCase();
        if(match[0] === match[0].toUpperCase()) return map.to.charAt(0).toUpperCase() + map.to.slice(1);
        return map.to;
      });
    }catch(e){
      console.warn('mapping error', map, e);
    }
  }
  return t;
}

function processTextNode(node){
  if(!node || node.nodeType !== Node.TEXT_NODE) return;
  if(!node.textContent || !node.textContent.trim()) return;
  if(isEditableNode(node)) return;
  // quick filter: only run if appears to contain targeted tokens (including articles)
  if(!/\b(ele|ela|dele|dela|eles|elas|aluno|aluna|amigo|amiga|aquele|aquela|todos|todas|o|a|os|as)\b/i.test(node.textContent)) return;
  const original = node.textContent;
  const modified = applyMappingsToText(original);
  if(modified !== original){
    node.textContent = modified;
    reportChange(original, modified);
  }
}

function walkAndProcess(root){
  try{
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let n; const nodes=[];
    while(n = walker.nextNode()) nodes.push(n);
    nodes.forEach(processTextNode);
    setStatus({stage:'walked', count: nodes.length, ts: new Date().toISOString()});
    return nodes.length;
  }catch(e){
    console.error('walk error', e);
    setStatus({stage:'walk-error', error:String(e)});
    return 0;
  }
}

// report change to storage & popup
function reportChange(original, modified){
  try{
    const rec = {original: original.slice(0,300), modified: modified.slice(0,300), ts: new Date().toISOString(), url: location.href};
    if(chrome && chrome.storage && chrome.storage.local){
      chrome.storage.local.get(['changes'], res => {
        const arr = res.changes || [];
        arr.unshift(rec);
        if(arr.length>200) arr.length=200;
        chrome.storage.local.set({changes: arr});
      });
    }
    // send message to popup if open
    if(chrome && chrome.runtime && chrome.runtime.sendMessage){
      chrome.runtime.sendMessage({type:'CHANGE', data: rec}, ()=>{});
    }
  }catch(e){ console.error('reportChange', e); }
}

// Simple suggestion generator: finds repeated tokens not converted and proposes mapping
function generateSuggestions(sampleSize=5000){
  try{
    // gather text from page
    const text = document.body ? document.body.innerText.slice(0,sampleSize) : '';
    const words = text.toLowerCase().match(/\b[\p{L}çãõéêíóúàâôäëü-]+\b/gu) || [];
    const freq = {};
    words.forEach(w => { freq[w]= (freq[w]||0)+1; });
    // candidate tokens: high frequency tokens that are not in exceptions and end with o/a
    const candidates = Object.keys(freq).filter(w => w.length>2 && /[oa]$/.test(w) && !EXCEPTIONS.has(w));
    candidates.sort((a,b)=>freq[b]-freq[a]);
    const suggestions = [];
    for(const c of candidates.slice(0,50)){
      // propose rule c -> replace final o/a by e (simple heuristic)
      const proposed = c.replace(/[oa]$/,'e');
      if(proposed && proposed !== c){
        suggestions.push({from:c, to:proposed, count: freq[c]});
      }
    }
    // store suggestions
    if(chrome && chrome.storage && chrome.storage.local){
      chrome.storage.local.set({suggestions: suggestions}, ()=>{});
    }
    return suggestions;
  }catch(e){ console.error('suggest error', e); return []; }
}

// observer
function startObserver(){
  if(observer) return;
  observer = new MutationObserver(muts => {
    if(!isActive) return;
    for(const m of muts){
      m.addedNodes && m.addedNodes.forEach(n => {
        if(n.nodeType === Node.ELEMENT_NODE) walkAndProcess(n);
        else if(n.nodeType === Node.TEXT_NODE) processTextNode(n);
      });
    }
  });
  try{ observer.observe(document.body || document.documentElement, {childList:true, subtree:true, characterData:true}); setStatus({stage:'observing', ts:new Date().toISOString()}); }
  catch(e){ setStatus({stage:'observer-error', error:String(e)}); }
}

function stopObserver(){ if(observer){ observer.disconnect(); observer=null; setStatus({stage:'stopped'}); } }

function init(){
  try{
    if(chrome && chrome.storage && chrome.storage.local){
      chrome.storage.local.get([SETTINGS_KEY], res => {
        isActive = (res && res[SETTINGS_KEY] !== undefined) ? res[SETTINGS_KEY] : true;
        const pageSig = shouldBlockByPage();
        setStatus({stage:'init', active:isActive, pageSig});
        if(!isActive) { setStatus({stage:'disabled-by-setting'}); return; }
        if(pageSig && pageSig.type==='block'){ setStatus({stage:'blocked-by-page', reason:pageSig.reason}); return; }
        walkAndProcess(document.body || document.documentElement);
        startObserver();
        // generate suggestions asynchronously
        setTimeout(()=>{ const s = generateSuggestions(); if(s && s.length) setStatus({stage:'suggestions', count:s.length}); }, 1200);
      });
    } else {
      const pageSig = shouldBlockByPage();
      if(pageSig && pageSig.type==='block'){ setStatus({stage:'blocked-by-page', reason:pageSig.reason}); return; }
      walkAndProcess(document.body || document.documentElement);
      startObserver();
    }
  }catch(e){ setStatus({stage:'init-error', error:String(e)}); }
}

// message listener for popup
if(chrome && chrome.runtime && chrome.runtime.onMessage){
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if(msg && msg.type==='TOGGLE'){ 
      isActive = !!msg.active; 
      if(isActive){ walkAndProcess(document.body); startObserver(); } 
      else stopObserver(); 
      sendResponse({ok:true, active: isActive}); 
      return true; 
    }
    else if(msg && msg.type==='PING'){ 
      sendResponse({status: window.__neutralizador_status || {stage:'no-status'}}); 
      return true; 
    }
    else if(msg && msg.type==='GET_SUGGESTIONS'){ 
      chrome.storage.local.get(['suggestions'], r=> {
        sendResponse({suggestions: r.suggestions || []});
      }); 
      return true; 
    }
    else if(msg && msg.type==='APPLY_SUGGESTION'){ // apply one suggestion globally (dangerous) - add mapping and re-run
      const s = msg.suggestion;
      if(s && s.from && s.to){
        try{
          // add mapping at runtime
          MAPPINGS.push({ r: new RegExp('\\b'+s.from+'\\b','gi'), to: s.to });
          // persist to storage rules (simple approach)
          chrome.storage.local.get(['custom_mappings'], r=>{
            const cm = r.custom_mappings || [];
            cm.unshift(s);
            chrome.storage.local.set({custom_mappings: cm}, ()=>{});
          });
          walkAndProcess(document.body);
          sendResponse({ok:true});
        }catch(e){ sendResponse({ok:false, error:String(e)}); }
      } else sendResponse({ok:false, error:'invalid'});
      return true;
    }
    return false;
  });
}

// load rules and init
init();
