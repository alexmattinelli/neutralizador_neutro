const SETTINGS_KEY='ativo';
const statusEl = document.getElementById('status');
const out = document.getElementById('out');

function log(t){ out.textContent = (new Date().toLocaleTimeString()) + ' — ' + t + '\n\n' + out.textContent; }

function setStatusText(t){ statusEl.textContent = t; }

chrome.storage.local.get([SETTINGS_KEY], res=>{
  const ativo = (res && res[SETTINGS_KEY] !== undefined) ? res[SETTINGS_KEY] : true;
  setStatusText(ativo ? 'Ativo' : 'Desativado');
});

document.getElementById('toggle').addEventListener('click', ()=>{
  chrome.storage.local.get([SETTINGS_KEY], res=>{
    const atual = (res && res[SETTINGS_KEY] !== undefined) ? res[SETTINGS_KEY] : true;
    const novo = !atual;
    chrome.storage.local.set({[SETTINGS_KEY]: novo}, ()=>{
      setStatusText(novo ? 'Ativo' : 'Desativado');
      // notify active tab
      chrome.tabs.query({active:true,currentWindow:true}, tabs=>{
        if(!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, {type:'TOGGLE', active: novo}, resp=>{
          log('TOGGLE enviado; resposta: ' + JSON.stringify(resp));
        });
      });
    });
  });
});

document.getElementById('check').addEventListener('click', ()=>{
  chrome.tabs.query({active:true,currentWindow:true}, tabs=>{
    if(!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {type:'PING'}, resp=>{
      if(resp && resp.status){
        log('Status do content script: ' + JSON.stringify(resp.status));
        setStatusText(resp.status.stage || 'Ativo');
      } else {
        // fallback: read from storage
        chrome.storage.local.get(['neutralizador_status','changes','suggestions'], r=>{
          log('Status via storage: ' + JSON.stringify(r.neutralizador_status || 'nenhum'));
          if(r.changes) log('Ultimas alterações: ' + JSON.stringify((r.changes||[]).slice(0,5)));
          if(r.suggestions) log('Sugestões: ' + JSON.stringify((r.suggestions||[]).slice(0,10)));
        });
      }
    });
  });
});

document.getElementById('suggest').addEventListener('click', ()=>{
  chrome.tabs.query({active:true,currentWindow:true}, tabs=>{
    if(!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {type:'GET_SUGGESTIONS'}, resp=>{
      if(resp && resp.suggestions){
        log('Sugestões geradas: ' + JSON.stringify(resp.suggestions.slice(0,20)));
        // offer quick apply for top suggestion
        if(resp.suggestions.length){
          const top = resp.suggestions[0];
          if(confirm('Aplicar sugestão automática: ' + top.from + ' -> ' + top.to + ' (aplicar na aba atual)?')){
            chrome.tabs.sendMessage(tabs[0].id, {type:'APPLY_SUGGESTION', suggestion: top}, r=>{
              log('APPLY_SUGGESTION resposta: ' + JSON.stringify(r));
            });
          }
        }
      } else {
        log('Nenhuma sugestão retornada.');
      }
    });
  });
});
