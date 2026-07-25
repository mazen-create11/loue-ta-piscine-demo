(function(){
  'use strict';

  var STORAGE_KEY = 'ltp-client-messages-v1';
  var seed = [
    {
      id:'claire',name:'Claire',initial:'C',verified:true,listing:'La piscine des Micocouliers',city:'Aix-en-Provence',status:'pending',unread:2,last:'il y a 4 min',
      booking:{day:'25',month:'JUIL.',title:'Samedi 25 juillet · 9 h – 11 h',meta:'4 baigneurs · séance ouverte',total:'28 €'},
      messages:[
        {id:'c1',author:'system',body:'Conversation ouverte depuis la fiche de la piscine.',time:'Aujourd’hui'},
        {id:'c2',author:'host',body:'Bonjour Mazen, oui, l’accès se fait directement par le portillon du jardin.',time:'18:42'},
        {id:'c3',author:'me',body:'Parfait, merci. La piscine est bien chauffée samedi matin ?',time:'18:44'},
        {id:'c4',author:'host',body:'Oui, elle sera à 27 °C. Les vestiaires et la douche extérieure seront accessibles dès votre arrivée.',time:'18:47'}
      ]
    },
    {
      id:'marc',name:'Marc',initial:'M',verified:true,listing:'Le jacuzzi des Oliviers',city:'Marseille',status:'confirmed',unread:0,last:'hier',
      booking:{day:'29',month:'JUIL.',title:'Mercredi 29 juillet · 19 h – 21 h',meta:'2 personnes · privatisation',total:'50 €'},
      messages:[
        {id:'m1',author:'system',body:'Réservation confirmée · coordonnées débloquées.',time:'Hier'},
        {id:'m2',author:'host',body:'Bonsoir ! Le jacuzzi sera prêt à votre arrivée. Les serviettes sont fournies.',time:'17:12'},
        {id:'m3',author:'me',body:'Super, à mercredi !',time:'17:18'}
      ]
    },
    {
      id:'sophie',name:'Sophie',initial:'S',verified:true,listing:'Le sauna de la bastide',city:'Aix-en-Provence',status:'completed',unread:0,last:'12 j',
      booking:{day:'13',month:'JUIL.',title:'Lundi 13 juillet · 18 h – 20 h',meta:'2 personnes · terminée',total:'36 €'},
      messages:[
        {id:'s1',author:'host',body:'Merci pour votre venue. J’espère que la séance vous a plu !',time:'20:18'},
        {id:'s2',author:'me',body:'C’était parfait, merci pour l’accueil.',time:'20:24'}
      ]
    }
  ];

  function validConversation(c){
    return c && typeof c.id==='string' && typeof c.name==='string' && c.booking && Array.isArray(c.messages);
  }
  function load(){
    try{
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(Array.isArray(parsed) && parsed.length && parsed.every(validConversation)) return parsed;
    }catch(e){}
    return JSON.parse(JSON.stringify(seed));
  }
  function save(){
    try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(state.conversations)); }catch(e){}
  }
  function esc(value){
    return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function uid(){ return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'm-'+Date.now()+'-'+Math.random().toString(16).slice(2); }
  function selected(){ return state.conversations.find(function(c){return c.id===state.selected;}) || state.conversations[0]; }

  var params = new URLSearchParams(location.search);
  var state = {conversations:load(),selected:params.get('conversation') || 'claire',filter:'all',query:''};
  if(!state.conversations.some(function(c){return c.id===state.selected;})) state.selected=state.conversations[0].id;

  var list=document.getElementById('conversation-list');
  var stream=document.getElementById('message-stream');
  var input=document.getElementById('message-input');
  var send=document.getElementById('send-button');
  var menu=document.getElementById('composer-menu');
  var plus=document.getElementById('composer-plus');
  var toastTimer;

  function toast(message){
    var el=document.getElementById('message-toast');
    el.textContent=message;el.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove('show');},2400);
  }
  function statusText(status){ return status==='confirmed'?'Confirmée':status==='completed'?'Terminée':'Demande en cours'; }
  function lastMessage(c){ var m=c.messages[c.messages.length-1]; return m ? m.body : 'Nouvelle conversation'; }

  function renderList(){
    var term=state.query.toLowerCase();
    var items=state.conversations.filter(function(c){
      var match=!term || (c.name+' '+c.listing+' '+c.city).toLowerCase().includes(term);
      return match && (state.filter==='all' || c.status!=='completed');
    });
    list.innerHTML=items.length?items.map(function(c){
      return '<button class="conversation-item '+(c.id===state.selected?'active ':'')+(c.unread?'unread':'')+'" type="button" data-id="'+esc(c.id)+'" aria-current="'+(c.id===state.selected?'true':'false')+'">'+
        '<span class="conversation-avatar">'+esc(c.initial)+'</span><span class="conversation-copy"><span class="topline"><b>'+esc(c.name)+'</b>'+(c.verified?'<i class="verified">✓</i>':'')+'</span><small>'+esc(c.listing)+' · '+esc(c.city)+'</small><p>'+esc(lastMessage(c))+'</p></span><span class="conversation-side">'+esc(c.last)+(c.unread?'<i>'+c.unread+'</i>':'')+'</span></button>';
    }).join(''):'<p class="conversation-empty">Aucune conversation trouvée.</p>';
    var unread=state.conversations.reduce(function(n,c){return n+(Number(c.unread)||0);},0);
    document.getElementById('unread-total').textContent=unread;
    document.getElementById('unread-total').hidden=!unread;
  }

  function renderThread(){
    var c=selected(),b=c.booking;
    document.getElementById('thread-avatar').textContent=c.initial;
    document.getElementById('thread-name').textContent=c.name;
    document.getElementById('thread-listing').textContent=c.listing+' · '+c.city;
    document.getElementById('booking-day').textContent=b.day;
    document.getElementById('booking-month').textContent=b.month;
    document.getElementById('booking-status').textContent=statusText(c.status);
    document.getElementById('booking-title').textContent=b.title;
    document.getElementById('booking-meta').textContent=b.meta;
    document.getElementById('booking-total').textContent=b.total;
    var privacy=document.getElementById('privacy-note');
    privacy.classList.toggle('confirmed',c.status!=='pending');
    privacy.querySelector('span').textContent=c.status==='pending'?'Vos coordonnées restent masquées jusqu’à la réservation confirmée.':'Réservation confirmée : vos coordonnées peuvent maintenant être partagées.';
    stream.innerHTML='<div class="date-divider">Aujourd’hui</div>'+c.messages.map(function(m){
      if(m.author==='system') return '<div class="message-row system"><span class="system-message">'+esc(m.body)+'</span></div>';
      var mine=m.author==='me';
      return '<div class="message-row '+(mine?'me':'host')+'">'+(mine?'':'<span class="message-mini-avatar">'+esc(c.initial)+'</span>')+'<div class="message-bubble"><p>'+esc(m.body)+'</p><time>'+esc(m.time)+'</time></div></div>';
    }).join('');
    requestAnimationFrame(function(){stream.scrollTop=stream.scrollHeight;});
  }

  function selectConversation(id,push){
    state.selected=id;
    var c=selected();c.unread=0;save();renderList();renderThread();
    document.body.classList.add('thread-open');
    if(push!==false) history.replaceState(null,'','?conversation='+encodeURIComponent(id));
  }

  function maskContacts(value){
    var masked=false;
    var text=value.replace(/(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}/g,function(){masked=true;return '•• •• •• •• ••';});
    text=text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,function(){masked=true;return '•••@•••';});
    return {text:text,masked:masked};
  }
  function now(){ return new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date()); }
  function addReply(c){
    var replies={claire:'Avec plaisir. Si vous avez une autre question sur l’accès ou les équipements, je suis là.',marc:'Parfait, je vous confirme tout dans le fil de réservation.',sophie:'Merci pour votre message !'};
    var typing=document.createElement('div');typing.className='message-row host';typing.id='typing';typing.innerHTML='<span class="message-mini-avatar">'+esc(c.initial)+'</span><div class="message-bubble typing-bubble"><i></i><i></i><i></i></div>';stream.appendChild(typing);stream.scrollTop=stream.scrollHeight;
    setTimeout(function(){
      c.messages.push({id:uid(),author:'host',body:replies[c.id]||'Merci pour votre message, je vous réponds très vite.',time:now()});c.last='à l’instant';save();renderList();if(selected().id===c.id)renderThread();
    },1100);
  }
  function submitMessage(value){
    var c=selected(),clean=value.trim();if(!clean)return;
    var protectedMessage=c.status==='pending'?maskContacts(clean):{text:clean,masked:false};
    c.messages.push({id:uid(),author:'me',body:protectedMessage.text,time:now()});
    if(protectedMessage.masked)c.messages.push({id:uid(),author:'system',body:'Coordonnées masquées automatiquement avant confirmation.',time:now()});
    c.last='à l’instant';input.value='';send.disabled=true;save();renderList();renderThread();
    toast(protectedMessage.masked?'Coordonnées protégées · message envoyé':'Message envoyé');
    addReply(c);
  }

  list.addEventListener('click',function(e){var item=e.target.closest('[data-id]');if(item)selectConversation(item.dataset.id);});
  document.getElementById('conversation-search').addEventListener('input',function(){state.query=this.value.trim();renderList();});
  document.querySelector('.conversation-filters').addEventListener('click',function(e){
    var button=e.target.closest('[data-filter]');if(!button)return;state.filter=button.dataset.filter;
    this.querySelectorAll('button').forEach(function(b){var active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-selected',active);});renderList();
  });
  document.getElementById('message-form').addEventListener('submit',function(e){e.preventDefault();submitMessage(input.value);});
  input.addEventListener('input',function(){send.disabled=!this.value.trim();});
  document.getElementById('quick-replies').addEventListener('click',function(e){if(e.target.tagName==='BUTTON'){input.value=e.target.textContent;send.disabled=false;input.focus();}});
  plus.addEventListener('click',function(){var open=menu.hidden;menu.hidden=!open;plus.setAttribute('aria-expanded',open);});
  menu.addEventListener('click',function(e){
    var action=e.target.dataset.action;if(!action)return;menu.hidden=true;plus.setAttribute('aria-expanded','false');
    if(action==='rules')location.href='fiche.html#reglement';else if(action==='photo')toast('Ajout de photo prêt dans l’application');else toast('Le centre d’aide a été prévenu');
  });
  document.getElementById('thread-back').addEventListener('click',function(){document.body.classList.remove('thread-open');history.replaceState(null,'','messages.html');});
  document.getElementById('help-button').addEventListener('click',function(){toast('Demande envoyée à l’équipe support');});
  document.getElementById('thread-more').addEventListener('click',function(){toast('Options de la conversation');});
  document.addEventListener('click',function(e){if(!e.target.closest('.message-composer')){menu.hidden=true;plus.setAttribute('aria-expanded','false');}});

  renderList();renderThread();
  if(params.get('conversation'))document.body.classList.add('thread-open');
})();
