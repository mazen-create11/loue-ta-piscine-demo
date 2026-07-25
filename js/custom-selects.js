(function(){
  'use strict';
  var active=null;
  var chevron='<svg viewBox="0 0 24 24" fill="none" stroke-width="2" aria-hidden="true"><path d="m7 9.5 5 5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var check='<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" aria-hidden="true"><path d="m6.5 12.5 3.5 3.5 7.5-8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function close(){
    if(!active)return;
    active.wrap.classList.remove('open');
    active.button.setAttribute('aria-expanded','false');
    active.menu.remove();
    active=null;
  }
  function position(state){
    var rect=state.button.getBoundingClientRect();
    var width=Math.max(rect.width,220);
    state.menu.style.width=Math.min(width,window.innerWidth-20)+'px';
    state.menu.style.left=Math.max(10,Math.min(rect.left,window.innerWidth-width-10))+'px';
    state.menu.style.top=(rect.bottom+7)+'px';
    requestAnimationFrame(function(){
      var menuRect=state.menu.getBoundingClientRect();
      if(menuRect.bottom>window.innerHeight-10 && rect.top>menuRect.height+14)state.menu.style.top=(rect.top-menuRect.height-7)+'px';
    });
  }
  function open(instance,focusIndex){
    if(instance.select.disabled)return;
    if(active&&active.wrap===instance.wrap){close();return;}
    close();
    var menu=document.createElement('div');
    menu.className='app-select-menu';menu.id=instance.menuId;menu.setAttribute('role','listbox');
    Array.prototype.forEach.call(instance.select.options,function(option,index){
      var item=document.createElement('button');
      item.type='button';item.className='app-select-option';item.setAttribute('role','option');item.setAttribute('aria-selected',option.selected?'true':'false');item.disabled=option.disabled;
      item.innerHTML='<span>'+option.textContent+'</span>'+check;
      item.addEventListener('click',function(){instance.select.selectedIndex=index;instance.select.dispatchEvent(new Event('input',{bubbles:true}));instance.select.dispatchEvent(new Event('change',{bubbles:true}));sync(instance);close();instance.button.focus();});
      item.addEventListener('keydown',function(event){
        var items=Array.prototype.slice.call(menu.querySelectorAll('.app-select-option:not(:disabled)'));var at=items.indexOf(item);
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}
        if(event.key==='Escape'){event.preventDefault();close();instance.button.focus();}
      });
      menu.appendChild(item);
    });
    document.body.appendChild(menu);instance.wrap.classList.add('open');instance.button.setAttribute('aria-expanded','true');
    active={wrap:instance.wrap,button:instance.button,menu:menu};position(active);
    if(focusIndex!==undefined){var items=menu.querySelectorAll('.app-select-option');(items[focusIndex]||items[0]).focus();}
  }
  function sync(instance){
    var option=instance.select.options[instance.select.selectedIndex];
    instance.label.textContent=option?option.textContent:'Choisir';instance.button.disabled=instance.select.disabled;
    instance.button.setAttribute('aria-invalid',instance.select.required&&!instance.select.value?'true':'false');
  }
  function enhance(select,index){
    if(select.dataset.enhanced==='true')return;
    select.dataset.enhanced='true';select.classList.add('app-select-source');select.tabIndex=-1;
    var wrap=document.createElement('div');wrap.className='app-select';
    var button=document.createElement('button');button.type='button';button.className='app-select-trigger';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
    var label=document.createElement('span');button.appendChild(label);button.insertAdjacentHTML('beforeend',chevron);
    select.parentNode.insertBefore(wrap,select);wrap.appendChild(select);wrap.appendChild(button);
    var instance={select:select,wrap:wrap,button:button,label:label,menuId:'app-select-'+index};button.setAttribute('aria-controls',instance.menuId);
    var sourceLabel=select.getAttribute('aria-label');if(sourceLabel)button.setAttribute('aria-label',sourceLabel);
    button.addEventListener('click',function(){open(instance);});
    button.addEventListener('keydown',function(event){if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Enter'||event.key===' '){event.preventDefault();open(instance,Math.max(0,select.selectedIndex));}});
    select.addEventListener('change',function(){sync(instance);});sync(instance);
  }
  function init(root){Array.prototype.forEach.call((root||document).querySelectorAll('select:not([data-native])'),enhance);}
  document.addEventListener('click',function(event){if(active&&!event.target.closest('.app-select-menu')&&!event.target.closest('.app-select'))close();});
  window.addEventListener('resize',close);window.addEventListener('scroll',function(event){if(active&&!(event.target instanceof Element&&event.target.closest('.app-select-menu')))position(active);},true);
  document.addEventListener('custom-selects:refresh',function(){init(document);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){init(document);});else init(document);
})();
