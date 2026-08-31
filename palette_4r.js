
    


class Dashboard {

    static onoff = "off";
    static interval;
    
    static switch(itime) {
    
      if (Dashboard.onoff == "off") {
        Dashboard.interval =  setInterval(() => {
          $('.palette.body.exe.spreadsheet').trigger('pointerdown');
          $('.palette.body.exe.echart').trigger('pointerdown');
        },itime);
        Dashboard.onoff = "on";
      } else {
        clearInterval(Dashboard.interval);
        Dashboard.onoff = "off";
      }
    setstring(Dashboard.onoff);
    
    }
}


class Palette {

    static dashboardonoff = "off";
    static dashboard

    static paint;
    
//    static spread_ar = [];
	
	static mode = "edit";
	
    static aeskey = '3fer3983f3avbz312';
    static encpass = '949757ff4df9c4655144b58f9a98c790dedf4270';
    
    static known_class = new Set(["palette","body","top","target","move","size","eraser","exe",
                                  "edit", "texta", "button","text","text2","textarea", "markdown","ratio","pulldown",
                                  "file","frac","spreadsheet", "echart","cinderella","timer",
                                  "compound","compound_edit", "edit_panel", "init_elm"]);

    static known_element_class = new Set(["button","text","text2","textarea", "markdown","ratio","pulldown",
                                  "file","frac","spreadsheet", "echart","cinderella","timer",
                                  "compound"]);
                                  
    static debug = false;
                                  
	static look_for_index_num(classname) {
      let c1 = '.'+classname;
      let pbs = document.querySelectorAll('.palette.top.'+classname);
      let ids = new Array();
      pbs.forEach(pb => ids.push(Number(pb.getAttribute("index"))));

      for (let i = 1; i <= ids.length+1; i++){
        if (!(ids.includes(i))) {
        	return i;
        }
      }
      
      alert("look_for_index_num:: ERROR detected!!");
    }


	static index_num_list(classname) {
	
//	  console.log("index_num_list classname="+JSON.stringify(classname));
      let qstr = '.palette.top.'+classname;
//	  console.log("index_num_list qstr="+JSON.stringify(qstr));
      let pbs = document.querySelectorAll(qstr);
// 	  console.log("index_num_list pbs="+JSON.stringify(pbs));
      let ids = new Array();
      pbs.forEach(pb => ids.push(Number(pb.getAttribute("index"))));
//      console.log("ids="+ids);

      return(ids);
      
    }


    static px2num(str) {
    	
    	return(Number(str.replace('px','')));
    	
    }
    
    static upload_image(ts,divname,idname) {

        var file = ts.files[0];
        
        if (file.type.indexOf("image") < 0) {
            alert("画像ファイルを指定してください。");
            return false;
        }

        var reader = new FileReader();
        reader.onload = ((file) => {
            return  (e) => {
                Palette.image2(e.target.result,divname,idname);
                console.log('file loaded');
                
            };
        })(file);
        reader.readAsDataURL(file);

// ファイルの選択をクリアする（同じファイルを連続して選択できるようにするため）

        ts.value = '';
        
   }
    
    
   static image2(src,divname,idname) {
  
    var img = new Image();

    img.onload = () => {

		let scale = img.naturalHeight/img.naturalWidth;
		img.style.width = "300px";
		img.style.height = (Math.round(300*scale))+'px';
		img.style.position = "absolute";
		img.style.top = "0px";
		img.style.left = "0px";
		img.style.border = "solid";
		img.classList.add("palette");
		img.classList.add("body");
		img.classList.add("target");
		img.classList.add("img");
		let element = new Palette_Img(divname,idname,400,35,$(img));
		return element;
     };
     
     img.src = src;

   }
   
  static setWidthHeight(width,height) {
  
    let wpx = String(width)+'px';
    let hpx = String(height)+'px';
    
    console.log("setWidthHeight width="+width+", height="+height);
  
    Palette.setElementWidthHeight('url_iframe',width,height);
    Palette.setElementHeight('test',height);
    $('#test').css({height: hpx});
//    Palette.setStyle('test','height',hpx);
    Palette.setElementHeight('paintbody',height);
    $('#paintbody').css({height: hpx});
//    Palette.setStyle('paintbody','height',hpx);
    $('.mainCanvas').css({width: wpx, height: hpx});
    $('.tempCanvas').css({width: wpx, height: hpx});
    
    Palette.paint = new lightPaint('paintbody','paintmenu', Number(width), Number(height));
  
  }
  
  static setElementWidthHeight(idname,width,height) {
  
    let t = document.getElementById(idname);
    t.setAttribute('width',width);
    t.setAttribute('height',height);
    
    
  }
  
  static setElementHeight(idname,height) {
  
    let t = document.getElementById(idname);
    console.log("setElementHeight idname="+idname);
    t.setAttribute('height',height);
    
  }
  
  static setStyle(idname,prop,val) {
  
    let t = document.getElementById(idname);
    let com = 
    eval('t.style.'+prop+' = '+val);
  
  }

  static checkpass(pass) {

    if (typeof pass === "undefined") return false;
    if (pass.length==0) return false;

    var shaObj = new jsSHA("SHA-1", "TEXT");
    var salt = 'algebrite';
    shaObj.update(salt);
    shaObj.update(pass);
    var hash = shaObj.getHash("HEX");
    if (hash == Palette.encpass) {
      return true;
    } else {
      return false;
    }

  }
  
  static mode_change() {
  
    if (Palette.mode=="edit") {
      
      Palette.mode = "user";
      
    } else {
   
      let pass = prompt("パスワードを入力してください");
      if (!(Palette.checkpass(pass))) {
        alert("パスワードが違います");
        return(0);
      }
      Palette.mode = "edit";
      
    }
    
    Palette.mode_set(Palette.mode);
  
  }

  static mode_set(mode) {
  
    console.log("mode_set mode="+mode);
  
    Palette.mode = mode;
  
    if (mode=="user") {
    
      $('.palette.move').hide();
      $('.palette.eraser').hide();
      $('.palette.size').hide();
      $('.palette.edit').hide();
      $('.exe:not(".target")').hide();
      $('.palette.content').hide();
      $('.palette.comp_edit.compound').hide();
      $('.palette.exe.text').show();

      $('.menu').hide();
      
      $('.paint_url').hide();
      $('.system_area').hide();
      
    } else {
    
      $('.palette.move').show();
      $('.palette.eraser').show();
      $('.palette.size').show();
      $('.palette.edit').show();
      $('.palette.content').show();
      $('.exe:not(".target")').show();
      $('.palette.comp_edit.compound').show();

//      $('.palette.top.compound *:not(.target)').hide();
      Palette_Compound.hide_edit();
      
      $('.menu').show();
      
      $('.paint_url').show();
      $('.system_area').show();
      
    }
  
  }
  
  static upload_pdforimage(ts,idname) {

     let file = ts.files[0];

     let reader = new FileReader();
     reader.onload = ((file) => {
       return  (e) => {
         $("#"+idname).attr("src",e.target.result);
       };
     })(file);
     reader.readAsDataURL(file);
   }
  
  static gen_button(divname,idname) {
  
    console.log('gen_clicibutton divname='+divname+', idname='+idname);

    new Palette_Button(divname,idname,850,55);
    
  }
  
  static gen_topbutton(divname,idname) {
  
    console.log('gen_topbutton divname='+divname+', idname='+idname);

    let ne = new Palette_Button(divname,idname,850,55);
    ne.css('z-index','20000');
    ne.addClass("overpaint");
    
  }
  
  static gen_text(divname,idname) {
  
    console.log('gen_button_text divname='+divname);
  
    new Palette_Text(divname,idname,850,55,200);
    
  }

  static gen_text2(divname,idname) {
  
    console.log('gen_button_text divname='+divname);
    console.log('gen_button_text idname='+idname);
    
    new Palette_Text2(divname,idname,850,55,200);
    
  }
  
  static gen_img(divname,idname) {
  
    console.log('gen_img divname='+divname);

    let p = new Palette_Img(divname,idname,400,55,300,204);
    
  }
  
  static gen_textarea(divname,idname) {
  
    console.log('gen_textarea divname='+divname);

    let p = new Palette_TextArea(divname,idname,400,55);
    
  }
  
  static gen_iframe(divname,idname,url) {
  
    console.log('gen_quill divname='+divname);

    let p = new Palette_iframe(divname,idname,url,300,60);
    
  }

  static gen_markdown(divname,idname) {
  
    console.log('gen_markdown divname='+divname);
  
    new Palette_Markdown(divname,idname,300,60);
    
  }

  static gen_radio(divname,idname,str) {
  
    console.log('gen_radio divname='+divname);
    
//    alert(str);
  
    new Palette_Radio(divname,idname,300,60,str);
    
  }
  
  static gen_pulldown(divname,idname,str) {
  
    console.log('gen_pulldown divname='+divname);
    
//    alert(str);
  
    new Palette_Pulldown(divname,idname,300,60,str);
    
  }
  
  static gen_file(divname,idname) {
  
    console.log('gen_file divname='+divname);
    
//    alert(str);
  
    let ne = new Palette_File(divname,idname,850,55);
    Palette_File.register(Number(ne.attr('index')));
    
  }
  
  static gen_toppulldown(divname,idname,str) {
  
    console.log('gen_toppulldown divname='+divname);
    
//    alert(str);
  
    let ne = new Palette_Pulldown(divname,idname,300,60,str);
    ne.css('z-index','20000');
    ne.addClass("overpaint");
    
  }
  
  static gen_fraction(divname,idname,str) {
  
    console.log('gen_fraction divname='+divname);
    
//    alert(str);
  
    new Palette_Fraction(divname,idname,300,60,str);
    
  }


  static gen_timer(divname,idname,min,sec) {
  
    console.log('gen_timer divname='+divname);
    
//    alert(str);
  
    new Palette_Timer(divname,idname,300,60,80,min,sec);
    
  }
  
  
  static gen_spreadsheet(divname,idname,row,col) {
  
    console.log('gen_spreadsheet divname='+divname);
    
    new Palette_Spreadsheet(divname,idname,300,60,row,col);
  
  }
  
  static gen_quill(divname,idname) {
  
    console.log('gen_quill divname='+divname);
    
    new Palette_Quill(divname,idname,300,60);
  
  }
  
  static gen_echart(divname,idname) {
  
    console.log('gen_echart divname='+divname+', idname='+idname);

    new Palette_Echart(divname,idname,300,60);
    
  }
  
  static gen_compound(divname,selector,elm) {
  
    console.log('gen_compound divname='+divname);
    
//    alert(str);
  
    new Palette_Compound(divname,selector,0,Palette_Compound.move_height,elm);
    
  
  
  }
  
  static update_suffix(jqe) {
    
    let maxnum=0, num, rtn=[];
    
    $("div.palette.top.markdown").each((i,e) => {
      num = Number(e.getAttribute('suffix').replace(/_suffix_/,""));
      if (maxnum < num) {
        maxnum = num;
      }
    });
    
    console.log("update_suffix maxnum="+maxnum);
    
    let suffix;
    let idx = maxnum + 1;
    
    jqe.find("div.palette.top.markdown").each((i,e) => {
//      console.log("update_suffix i="+i+", e.outerHTML="+e.outerHTML);
      suffix = "_suffix_"+String(idx+i);
      e.setAttribute('suffix',suffix);
      e.querySelector("div.wmd-button-bar").setAttribute("id","wmd-button-bar"+suffix);
      e.querySelector("div.wmd-preview").setAttribute("id","wmd-preview"+suffix);
      e.querySelector("textarea.wmd-input").setAttribute("id","wmd-input"+suffix);
      rtn.push(suffix);
    });
  
    return(rtn);
  
  }
  
  static update_selectors(je) {

//    console.log("update_selectors: je="+je.prop("outerHTML"));
    
    let title = "";
    
    let idname = je.attr("id");
    if (idname) {
      title = title + "i: "+idname+"\n";
    }
    
    let cls = je.attr("class").split(/\s+/);
    let cls2 = cls.filter(c => !Palette.known_class.has(c));
    if (cls2.length>0) {
      title = title + "c:";
      cls2.forEach(c => {
        title = title + " " + c;
      });
    }
    
    console.log("update_selectors title="+title);
    
    je.children(".move").val(title);
  }
  
  
  static gen_compound_menu(divname,selector,elm) {
  
    console.log('gen_compound_menu divname='+divname+', selector='+selector+', elm='+elm);
    
//    alert(str);
  
//    new Palette_Compound_Menu(divname,selector,0,Palette_Compound.move_height,elm);

//    let csrc = JSON.parse(Palette_Compound.cmenu[elm]);
    let csrc = Palette_Compound.cmenu[elm];
    let jcsrc = $(csrc);
//    console.log("gen_compound_menu jcsrc = "+jcsrc.prop("outerHTML"));
    jcsrc.find('.edit_panel.compound').hide();

    Palette.update_selectors(jcsrc);
    
    let suffixes = Palette.update_suffix(jcsrc);
//    alert(csrc);
//    jcsrc.appendTo($('#test'));

    console.log("gen_compound_menu jcsrc = "+jcsrc.prop("outerHTML"));

    Palette.update_index(jcsrc);
    
    Palette.update_id(jcsrc);

    let no = new Palette_Compound("test",selector,100,100,jcsrc);
    
    no.addClass(elm);
    
//    log();
    suffixes.forEach(s => {
      Palette_Markdown.starteditor(s);
      Palette_Markdown.delaytouch(s);
    });

/*
    jcsrc.find(".palette.top.file").each((i,e) => {
      console.log("file class found e="+e.outerHTML);
      Palette_File.register(Number(e.getAttribute("index")));
    });
*/

/*
    if (Palette_Compound.ccom[elm] !== undefined) {
      console.log("Palette_Compound.ccom[elm] = "+Palette_Compound.ccom[elm]);
      eval(Palette_Compound.ccom[elm]);
    }
*/
    
  }


  static update_index(jqe) {
  
//    console.log("update_index 1 jqe = "+jqe.prop("outerHTML"));

    let idx;
    let usedidx = {};
    let cname;
    
    let cusedidx = new Set(Palette.index_num_list("compound"));
    idx = 0;
    while (cusedidx.has(idx)) {
        idx++;
    }
    jqe.attr("index",idx);
    
    jqe.find("[index]").each((i,e) => {


//      console.log("1 update_index i="+i+", e.outerHTML="+e.outerHTML);
//      console.log("class="+Palette_Compound.pickup_name(e.getAttribute("class")));
      
      cname = Palette_Compound.pickup_name(e.getAttribute("class"));
      
//      console.log("cname="+cname);
      
      if (usedidx[cname] === undefined) {

        usedidx[cname] = new Set(Palette.index_num_list(cname));
//        console.log("Palette.index_num_list(cname)="+Palette.index_num_list(cname));
//        console.log("new usedidx["+cname+"]="+ JSON.stringify(usedidx[cname]));

      }
      idx = 0;
      while (usedidx[cname].has(idx)) {
        idx++;
      }
      usedidx[cname].add(idx);

//      console.log("idx="+idx);
//      console.log("usedidx="+JSON.stringify(usedidx));
      
      e.setAttribute("index",idx);
      
//      console.log("2 update_index i="+i+", e.outerHTML="+e.outerHTML);
    
    });
    
  }
  
  static update_id(jqe) {
  
//    console.log("update_id jqe="+jqe.prop("outerHTML"));
  
    let idx;

    let clist = ["palette","target","spreadsheet"];
    jqe.find("[id]").each((i,e) => {
      console.log("i="+i+", e = "+e.outerHTML);
      if (clist.every(c=>e.classList.contains(c))) {
        idx = e.parentNode.getAttribute("index");
        e.setAttribute("id","spread_sheet_"+idx);
      console.log("update_id idx="+idx);
      console.log("uddate_id id="+e.getAttribute("id"));
      } else {
//        alert("ERROR: id in compound menu element!!");
      }
    });
  }

 
  static readthisfile() {

    var snapshot = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    return snapshot;

  }

  static handleDownload2(content,bname) {
  
//    console.log("handleDownload2 content="+content);

    var blob = new Blob([ content ], { "type" : "text/plain" });
    console.log('handleDownload2');
    saveAs(blob, bname);
   
  }
  
  static append_system_init(coms) {
  
    $("#system_init_textarea").val($("#system_init_textarea").val()+"\n"+coms);
    
//    console.log("append_system_init = "+$("#system_init_textarea").val());
  
  }
  
  static get_system_init() {
  
    return($("#system_init_textarea").val());
  
  }
  
  static set_system_init(coms) {
  
    $("#system_init_textarea").val(coms);
  
  }

/*
  static save() {
  
    saveEdit();
  
  }
*/

/*
  static save() {
  
    let com;
    
    let system_init_str = Palette.get_system_init();

    delallscore();
    
    Palette.set_system_init("");
    
    Object.keys(Palette_Compound.cmenu).forEach(function(key) {
     com='Palette_Compound.cmenu["'+ key + '"] = String.raw`' + Palette_Compound.cmenu[key] + '`;\n';
     Palette.append_system_init(com);
    });

    let pbs = document.querySelectorAll('.palette.texta');
    pbs.forEach(pb => {
      pb.innerHTML = pb.value;
    });
    
    pbs = document.querySelectorAll('.palette.text.target');
    pbs.forEach(pb => {
    console.log('pb.value='+pb.value);
      pb.defaultValue = pb.value;
    });
    
    pbs = document.querySelectorAll('.palette.cindy.top');
    let scindy = '';
    let index;
    let code;
    let json,json2;
    let cindy;
    let cwidth,cheight;
    let port;
    let jsonvar;
    let init;
    let id;
    pbs.forEach(pb => {
      index = Number(pb.getAttribute('index'));
      json =  Palette_Cindy.cinderella_json[index];
      cindy = pb.querySelectorAll('.CindyJS-widget')[0];
      cwidth = Number(cindy.style.width.replace('px',''));
      cheight = Number(cindy.style.height.replace('px',''));
      jsonvar = JSON.parse(Palette_Cindy.cinderella_json[index]);
      jsonvar.ports[0].width = cwidth;
      jsonvar.ports[0].height = cheight;
      json2 = JSON.stringify(jsonvar);
      code = 'Palette_Cindy.cinderella_obj[' + index + '] = CindyJS(' + json2 + ');';
      init = JSON.stringify(Palette_Cindy.cinderella_init[index]);
      scindy = scindy + "\n\n" + 'Palette_Cindy.cinderella_code['+index+']=`'+code+'`;';
      scindy = scindy + "\n" + 'eval(Palette_Cindy.cinderella_code['+index+']);';
      scindy = scindy + "\n" + 'Palette_Cindy.cinderella_json['+index+']=`'+json2+'`;';
      scindy = scindy + "\n" + 'Palette_Cindy.cinderella_init['+index+']='+init+';';
      scindy = scindy + "\n" + 'Palette_Cindy.cinderella_obj['+index+'].evokeCS(Palette_Cindy.cinderella_init['+index+']);';
      
    });
    
    Palette.append_system_init(scindy);
    
    let its = document.querySelectorAll('.paint_url_data, paint_url_width, .show_hide_data');
    its.forEach(function(it) {
      it.setAttribute('value',it.value);
    });

    if ($('#Palette_h_text').length > 0) {
      let v = $('#Palette_h_text').val();
      $('#Palette_h_slider').attr('value',v);
      $('#Palette_h_text').attr('value',v);
      v = $('#Palette_v_text').val();
      $('#Palette_v_slider').attr('value',v);
      $('#Palette_v_text').attr('value',v);
      v = $('#Palette_s_text').val();
      $('#Palette_s_slider').attr('value',v);
      $('#Palette_s_text').attr('value',v);
    }
    
    var fname = location.pathname;
    var pass = fname.substring(0,fname.lastIndexOf('/'));
    var bname = fname.substring(fname.lastIndexOf('/')+1, fname.length);

    let si = document.querySelector('#system_init_textarea');
    si.innerHTML = si.value;
    
    var otext= Palette.readthisfile();
    
    var docobj = HtmlString_To_Document(otext);

    let st = docobj.querySelectorAll('head > style[type="text/css"]');
    st.forEach( function(s) {
      s.remove();
    });
    
    docobj.querySelector("#MathJax_Hidden").parentNode.remove();
    docobj.querySelector("#MathJax_Message").remove();
    docobj.querySelector("#MathJax_Font_Test").parentNode.remove();
    
    docobj.querySelectorAll("div.palette.top.markdown div.wmd-button-bar > .wmd-button-row").forEach(e => {
      e.remove();
    });
    
    docobj.querySelectorAll("div.palette.top.markdown div.wmd-preview > p").forEach(e => {
      e.remove();
    });
    

    pbs = docobj.querySelectorAll('.palette.cindy.top');
    
    pbs.forEach(pb => {
    
       pb.style.display = "block";
       
    });
    
    Palette.handleDownload2(docobj.documentElement.outerHTML,bname);
    
  }
*/

  static htmlContents(mode) {
  
    console.log("htmlContents mode="+mode);
  
    let com;
    
    let system_init_str = Palette.get_system_init();
     console.log("get_system_init()="+Palette.get_system_init());
    
    if (mode == "edit") {
      delallscore();
    }
    
    Palette.set_system_init("");

    Object.keys(Palette_Compound.cmenu).forEach(function(key) {
//     com='Palette_Compound.cmenu["'+ key + '"] = `' + Palette_Compound.cmenu[key] + '`;\n';
     com='Palette_Compound.cmenu["'+ key + '"] = String.raw`' + Palette_Compound.cmenu[key] + '`;\n';
     Palette.append_system_init(com);
//     console.log("get_system_init()="+Palette.get_system_init());
    });

    let pbs = document.querySelectorAll('.palette.texta');
    pbs.forEach(pb => {
      pb.innerHTML = pb.value;
    });
    
    pbs = document.querySelectorAll('.palette.text.target');
    pbs.forEach(pb => {
      pb.defaultValue = pb.value;
    });
    
    pbs = document.querySelectorAll('.palette.cindy.top');
    let scindy = '';
    let index;
    let code;
    let json,json2;
    let cindy;
    let cwidth,cheight;
    let port;
    let jsonvar;
    let init;
    let id;
    pbs.forEach(pb => {
      index = Number(pb.getAttribute('index'));
      json =  Palette_Cindy.cinderella_json[index];
      cindy = pb.querySelectorAll('.CindyJS-widget')[0];
      cwidth = Number(cindy.style.width.replace('px',''));
      cheight = Number(cindy.style.height.replace('px',''));
      jsonvar = JSON.parse(Palette_Cindy.cinderella_json[index]);
      jsonvar.ports[0].width = cwidth;
      jsonvar.ports[0].height = cheight;
      json2 = JSON.stringify(jsonvar);
      code = 'Palette_Cindy.cinderella_obj[' + index + '] = CindyJS(' + json2 + ');';
      init = JSON.stringify(Palette_Cindy.cinderella_init[index]);
      scindy = scindy + "\n\n" + 'Palette_Cindy.cinderella_code['+index+']=`'+code+'`;';
      scindy = scindy + "\n" + 'eval(Palette_Cindy.cinderella_code['+index+']);';
      scindy = scindy + "\n" + 'Palette_Cindy.cinderella_json['+index+']=`'+json2+'`;';
      scindy = scindy + "\n" + 'Palette_Cindy.cinderella_init['+index+']='+init+';';
      scindy = scindy + "\n" + 'Palette_Cindy.cinderella_obj['+index+'].evokeCS(Palette_Cindy.cinderella_init['+index+']);';
      
    });
    
    Palette.append_system_init(scindy);
    
//  jspreadsheet の内容の保存

    let rawdata, jsdata, colwidth, w, ct="", cols, j,  ncol;
    pbs = document.querySelectorAll('.palette.spreadsheet.top');

    pbs.forEach(pb => {
      index = Number(pb.getAttribute('index'));
	  if (!((typeof Palette_Spreadsheet.obj[index]) === 'undefined')) {
	    cols = [];
	    rawdata = Palette_Spreadsheet.obj[index].getData();
	    ncol = rawdata[0].length;
	    jsdata = JSON.stringify(rawdata);
	    cols.push({width: (Palette_Spreadsheet.obj[index].getWidth(0))[0] });
	    for (j=1; j<ncol; j++) {
	      cols.push({width: Palette_Spreadsheet.obj[index].getWidth(j)});
	    };
	    ct = ct + 'var sdom = document.getElementById("spread_sheet_'+index+'");\n';
	    ct = ct + 'sdom.innerHTML = "";\n';
	    ct = ct + 'Palette_Spreadsheet.obj['+index+'] = jspreadsheet(sdom, {data:'+jsdata+', columns: ' + JSON.stringify(cols) + '});\n';
	    console.log("ct1="+ct);
	    ct = ct + 'Palette_Spreadsheet.setHiddenCols('+index+', '+ JSON.stringify(Palette_Spreadsheet.getHiddenCols(index))+ ');\n';
	    console.log("ct2="+ct);
	  }
    });
    Palette.append_system_init(ct);
    
//  echart の内容の保存

    ct="";
    pbs = document.querySelectorAll('.palette.echart.top');

    let triggerflg = 0;
    pbs.forEach(pb => {
      index = Number(pb.getAttribute('index'));
	  if (!((typeof Palette_Echart.obj[index]) === 'undefined')) {
	    ct = ct + 'Palette_Echart.obj['+index+'] = echarts.init(document.getElementById("echart_' + index + '"));\n';
	    triggerflg = 1;
	  }
    });
    if (triggerflg == 1) {
      ct = ct + "$('.palette.body.exe.echart').trigger('pointerdown');\n";
    }
    Palette.append_system_init(ct);
    

// File の callback の登録

    ct="";
    pbs = document.querySelectorAll('.palette.file.top');

    pbs.forEach(pb => {
      index = Number(pb.getAttribute('index'));
      ct = ct + 'Palette_File.register(' + index + ');\n';
    });
    Palette.append_system_init(ct);

    let its = document.querySelectorAll('.paint_url_data, paint_url_width, .show_hide_data');
    its.forEach(function(it) {
      it.setAttribute('value',it.value);
    });

    if ($('#Palette_h_text').length > 0) {
      let v = $('#Palette_h_text').val();
      $('#Palette_h_slider').attr('value',v);
      $('#Palette_h_text').attr('value',v);
      v = $('#Palette_v_text').val();
      $('#Palette_v_slider').attr('value',v);
      $('#Palette_v_text').attr('value',v);
      v = $('#Palette_s_text').val();
      $('#Palette_s_slider').attr('value',v);
      $('#Palette_s_text').attr('value',v);
    }

    let v,je,name,paintdata,paintcode;

    if (mode == "user") {
      $('input[type="text"].palette').each((i,e) => {
        console.log("e.value => "+e.value);
        e.setAttribute("value",e.value);
      });
      $('.palette.pulldown select').each((i,e) => {
        je = $(e);
        v = je.val();
        console.log("v="+v);
        je.find("option[value='"+v+"']").attr('selected',true);
      });
      $('.palette.textarea.target').each((i,e) => {
//        e.innerText = e.value;
         e.innerHTML = e.value;
      });
      $('.palette.radio.target').each((i,e) => {
        name = e.querySelector('input[type="radio"]').getAttribute("name");
//        console.log("name="+name);
        je = $(e);
        v = je.find('input[name='+name+']:checked').val();
//        v = e.elements[name].value;
//        console.log("v="+v);
        je.find('input[value="'+v+'"]').attr('checked',true);
      });
      
//      if ($("#paintbody")) {
//      if (typeof Paint !== 'undefined') {
      if ((typeof lightPaint !== 'undefined') || (typeof superlightPaint !== 'undefined') || (typeof Paint !== 'undefined')) {
//        paintdata = Palette.paint.get_paintdata();
        paintdata = Palette.paint.get_paintdata();
        paintcode = '\nPalette.paint.load_paintdata(JSON.parse(\`'+paintdata+'\`));\n';
        Palette.append_system_init(paintcode);
      
      }
    } else {
      $('input[type="text"].palette').each((i,e) => {
        console.log("e.value => "+e.value);
        e.removeAttribute("value");
      });
      $('.palette.pulldown select option').removeAttr('selected');
      $('.palette.textarea.target').each((i,e) => {
        e.innerText = "";
      });
      $('.palette.radio.target').each((i,e) => {
        $(e).children('input').attr('checked',false);
      });
    }

    
    var fname = location.pathname;
    var pass = fname.substring(0,fname.lastIndexOf('/'));
    var bname = fname.substring(fname.lastIndexOf('/')+1, fname.length);

    let si = document.querySelector('#system_init_textarea');
    si.innerHTML = si.value;
    
    
    let docobj = document.cloneNode(true);
    
//    console.log("1  docobj="+docobj.documentElement.outerHTML);

    let st = docobj.querySelectorAll('head > style[type="text/css"]');
    st.forEach( function(s) {
      s.remove();
    });

/*
    docobj.querySelector("#MathJax_Hidden").parentNode.remove();
    docobj.querySelector("#MathJax_Message").remove();
    docobj.querySelector("#MathJax_Font_Test").parentNode.remove();
*/

	docobj.querySelectorAll("#MathJax_Hidden").forEach(e => {
	  e.parentNode.remove();
	});

	docobj.querySelectorAll("#MathJax_Message").forEach(e => {
	  e.remove();
	});

	docobj.querySelectorAll("#MathJax_Font_Test").forEach(e => {
	  e.parentNode.remove();
	});

	docobj.querySelectorAll(".sp-container.sp-hidden.sp-light").forEach(e => {
	  e.remove();
	});
    
    docobj.querySelectorAll("div.palette.top.markdown div.wmd-button-bar > .wmd-button-row").forEach(e => {
      e.remove();
    });
    
    docobj.querySelectorAll("div.palette.top.markdown div.wmd-preview > p").forEach(e => {
      e.remove();
    });
    
//    console.log("2  docobj="+docobj.documentElement.outerHTML);

    pbs = docobj.querySelectorAll('.palette.cindy.top');
    
    pbs.forEach(pb => {
       pb.style.display = "block";
    });

    if (typeof Paint !== 'undefined') {
      
      docobj.querySelector('#paintbody').innerHTML = "";
      docobj.querySelector('#paintmenu').innerHTML = "";
      
    }

//    console.log("3  docobj="+docobj.documentElement.outerHTML);

    let rtn = "<!DOCTYPE html>\n"+docobj.documentElement.outerHTML;
    
//    console.log("htmlContents rtn="+rtn);
    
    return(rtn);
  
  
  }


  static getbname() {
  
    let fname = location.pathname;
    
    return(fname.substring(fname.lastIndexOf('/')+1, fname.length));
    
  }
  
  static saveUser() {
  
    Palette.handleDownload2(Palette.htmlContents("user"),Palette.getbname());
  
  }
  
  static saveEdit() {
  
    Palette.handleDownload2(Palette.htmlContents("edit"),Palette.getbname());
  
  }
  
  
  
  static load_url(ts,jqsrc) {
  	
  	console.log('ts='+ts.parentNode.outerHTML);
  	
  	let url =   ts.parentNode.querySelector('.paint_url_data').value;

//    console.log('url='+url);
  	$(jqsrc).attr("src",url);
  	
  }

  static load_url_width(ts,jqsrc) {
  	
  	console.log('ts='+ts.parentNode.outerHTML);
  	
  	let url =   ts.parentNode.querySelector('.paint_url_data').value;
  	epagew =   Number(ts.parentNode.querySelector('.paint_url_width').value);
  	
//    console.log('url='+url);
  	$(jqsrc).attr("src",url);
  	
//    set_scale("#scale_div",(document.documentElement.clientWidth)/epagew);
    console.log("load_url_width epagew="+epagew);
    set_mode_scale();
//    console.log('document.QuerySelector(jqsrc).width='+document.querySelector(jqsrc).width);
    document.querySelector(jqsrc).setAttribute("width",epagew);
  	
  }
  
  static split_selector(selector)  {
  
    let tmp = selector.match(/\.([^#\.])+/g);
    let classname = [];
    if (tmp) {
      classname = tmp.map( e => e.replace(/\./g,'').trim() );
    }
    
    tmp = selector.match(/#([^#\.])+/g);
    let idname = [];
    if (tmp) {
      idname = tmp.map( e => e.replace(/#/g,'').trim() );
    }

    return({class: classname, id: idname});

  }
  
  static check_for_id(id) {
  
    console.log('check_for_id id='+id);
    console.log('query = '+document.querySelector("#Palette_"+id));
    if (id=="") return(false);
    if (document.querySelector("#Palette_"+id)) {
      return(false);
    } else {
      return(true);
    }
  }
  
  static toggle_display(dom) {
  
    console.log('toggle display');
  
    if (dom.style.display=="none") {
      dom.style.display = "block";
    } else {
      dom.style.display= "none";
    }
  
  }
  
  static upload_cinderella(ts,divname,idname) {

   var file = ts.files[0];
   console.log("upload_cinderella");
   console.log("ts="+ts.outerHTML);
   console.log("file="+file);
   console.log("divname="+divname);
   console.log("idname="+idname);

   console.log(file);

   var reader = new FileReader();
   reader.onload = ((file) => {
     return  (e) => {
       Palette.gen_cinderella(e.target.result,divname,idname);
       console.log('file loaded');
       ts.value = '';
     };
   })(file);
   
//   reader.readAsDataURL(file);
   reader.readAsText( file );
    
 }


  static gen_cinderella(src,divname,idname) {
 
    console.log("gen_cinderella divname="+divname+", idname="+idname+", src="+src);
  	
  	let index = Palette.look_for_index_num(Palette_Cindy.classname);

    let cs,width,height,json,csdata;
    
    [cs,width,height,json,csdata] = Palette.cutcindycom(src,index);
    
    console.log("return from cutcindycom: width="+width+", height="+height+", json="+json);
    console.log("cs="+cs);
    console.log("csdata="+csdata);
    
    let cscom = "";
    let s, key1;
    
    Object.keys(csdata).forEach(function (key) {
      key1 = key.replace(/^cs/,"cs"+index);
      s = '<script id="' + key1 + '" type="text/x-cindyscript">\n' + csdata[key] + '\n</script>\n';
      $('head').append($(s));
    });
    
    console.log("cscom="+cscom);

    let p = new Palette_Cindy(divname,idname,400,55,width,height,index);

    
    eval(cs);
    
//    Palette_Cindy.cinderella_obj[index].evokeCS(cscom);

    console.log('cutcindycom evaluated');
    
    Palette_Cindy.cinderella_code[index] = cs;
    Palette_Cindy.cinderella_json[index] = json;
    Palette_Cindy.cinderella_csscript[index] = csdata;
    Palette_Cindy.cinderella_init[index] = cscom;
    
    return;

  }
  
/*
  static gen_cinderella(src,divname,idname) {
 
    console.log("gen_cinderella divname="+divname+", idname="+idname+", src="+src);
    
//    let p = new Palette_Cindy(divname,idname,400,55,300,204);
  	
  	let index = Palette.look_for_index_num(Palette_Cindy.classname);

    let cs,width,height,json,csdata;
    
    [cs,width,height,json,csdata] = Palette.cutcindycom(src,index);
    
    console.log("return from cutcindycom: width="+width+", height="+height+", json="+json);
    console.log("cs="+cs);
    console.log("csdata="+csdata);
    
    let cscom = "";
    
    Object.keys(csdata).forEach(function (key) {
      cscom = cscom + key + "() := (" + csdata[key] + ");\n";
    });
    
    console.log("cscom="+cscom);
    
    let p = new Palette_Cindy(divname,idname,400,55,width,height,index);

    
    eval(cs);
    
//    Palette_Cindy.cinderella_obj[index].evokeCS(cscom);

    console.log('cutcindycom evaluated');
    
    Palette_Cindy.cinderella_code[index] = cs;
    Palette_Cindy.cinderella_json[index] = json;
    Palette_Cindy.cinderella_csscript[index] = csdata;
    Palette_Cindy.cinderella_init[index] = cscom;
    
    return;

  }
  
*/
  
  static cutcindycom(src,num) {
	
    console.log('cutcindycom num='+num+' src='+src);
    
    let parser = new DOMParser();
    let doc = parser.parseFromString(src, "text/html");
    let cs = doc.querySelector('script[type="text/javascript"]:not([src])').innerHTML;
    let result = cs.match(/script: \"(.*?)[^\\]\"/g);
    
    console.log("result="+result);

    if (!(result===null)) {
      for (let i=0; i<result.length; i++) {
        console.log('i='+i+', result[i]='+result[i]);
        console.log('replaced -> '+result[i].replace(/'/g,'DASHSYMBOL').replace(/([^\\])\"/g,"$1'").replace(/\\\"/g,'"'));
        cs = cs.replace(result[i],result[i].replace(/'/g,'DASHSYMBOL').replace(/\\xi/g,'XISYMBOL').replace(/([^\\])\"/g,"$1'").replace(/\\\"/g,'"'));
      }
    }
    console.log('cs = '+cs);
    let cscp = cs.slice();
    cscp = cscp.replace('var cdy = CindyJS(','');
    cscp = cscp.replace(/\);\s*$/,'');
    console.log("cscp="+cscp);

    let csvar;
    eval("csvar="+cscp);
    let ports = csvar.ports[0];
    let width = Number(ports.width);
    let height = Number(ports.height);
	console.log('width='+width+', height='+height);
	
	csvar["scripts"] = "cs"+num+"*";
	csvar["ports"][0]["id"] = "CSCanvas_"+num;
    
    let csscript = doc.querySelectorAll('script[type="text/x-cindyscript"]');
    console.log('csscript = '+csscript);
    
    var tmpid,oldhtml,csdata={};
    
    for (let i=0; i<csscript.length; i++) {
//      console.log('i='+i+', csscript[i] id='+csscript[i].id);
//      console.log('i='+i+', csscript[i] innerHTML='+csscript[i].innerHTML);
//      console.log(document.querySelector('#'+csscript[i].id).innerHTML);
//      tmpid = '#'+csscript[i].id;
//      oldhtml = document.querySelector(tmpid).innerHTML;
//      document.querySelector(tmpid).innerHTML = oldhtml  + "\n" + csscript[i].innerHTML;
//      console.log("new innerHTML="+document.querySelector(tmpid).innerHTML);
      csdata[csscript[i].id] = csscript[i].innerHTML;
    }
    
    cs = 'Palette_Cindy.cinderella_obj[' + num + '] = CindyJS('+JSON.stringify(csvar)+');';
    
/*
    
    console.log(JSON.stringify(csdata));
    
    var sbegin = 'var cdy = CindyJS({';
    	
    var sbegin1 = 'Palette_Cindy.cinderella_obj[' + num + '] = CindyJS({';

//    cs = cs.replace(sbegin,sbegin1);
    cs = cs.replace(/var\s+cdy\s*=\s*CindyJS\(\{/,sbegin1);

    var s1 = 'id: "CSCanvas"';
    var s2 = 'id: "CSCanvas_'+num+'"';

    console.log('function cutcindycom s1='+s1+' s2='+s2);

//    cs = cs.replace(s1,s2);
    cs = cs.replace(/id\s*\:\s*\"CSCanvas\"/,s2);
    
//    cs = cs + ';';
    cs = cs.replace(/\\n/g," ");
    console.log('cutcindycom: cs='+cs);

//    cscp = cscp.replace(s1,s2);
//    ports.id = 'CSCanvas_'+num;
    
    var s1 = 'scripts: "cs*"';
    var s2 = 'scripts: "cs' + num + '*"';

//    cs = cs.replace(s1,s2);
    cs = cs.replace(/scripts\s*:\s*"cs\*"/,s2);
    
    console.log("**************************  cs="+cs);
*/


    return([cs,width,height,JSON.stringify(csvar),csdata]);

  }
  
  static system_init() {
  
    console.log("system_init() start");
    
//    console.log($('#system_init_textarea').text());

    eval($('#system_init_textarea').text());

     console.log("system_init() finish");
    
  }



  static send_data_url2(filename,value,url) {

    console.log('send_data_url2:  value='+value);

    var form = document.createElement('form' );
    document.body.appendChild( form );
    var input = document.createElement('input');
    input.setAttribute('type','hidden');
    input.setAttribute('name','data');
    input.setAttribute('value', value );
    form.appendChild( input );
    var input2 = document.createElement('input');
    input2.setAttribute('type','hidden');
    input2.setAttribute('name','filename');
    input2.setAttribute('value', filename );
    form.appendChild( input2 );
    form.setAttribute('action',url);
    form.setAttribute('method','post');
    form.submit();

  }


  static python_com(com) {

    var enccom = encodeURIComponent(com);
    console.log("enccom="+enccom);
//    var urlcom = "http:/www.ktky.online/el/python_com.php?key="+enccom;
    var urlcom = "https:/www.koemon.com/el/python_com.php?key="+enccom;
//    var urlcom = "http:/133.18.239.183/el/python_com.php?key="+enccom;
    var result = $.ajax({
        type: 'GET',
        url: urlcom,
//        dataType: 'jsonp',
//        dataType: 'json',
//        dataType: 'text',
        async: false
    }).responseText;
    
//    console.log("result="+result);
//    console.log("typeof(result)="+typeof(result));
//    console.log("result[0]="+result[0]);

    return result;

  }
  
  static exec_url(url, com) {
  
  /*
    var uc = urlcom.split("?");
    let url = uc[0];
    let com = uc.shift.join();
    let enccom = encodeURIComponent(com);
    let urlcom1 = url+'?'+enccom;
  */
    let param = "";
    let sc = "?";
    
    Object.keys(com).forEach(k => {param = param + sc + k + "=" + encodeURIComponent(com[k]); sc="&"});
    
    let urlcom = url + param;
    
    console.log("urlcom = " + urlcom);
    
//    console.log("exe_url : enccom1="+enccom1);
    var result = $.ajax({
        type: 'GET',
        url: urlcom,
//        dataType: 'jsonp',
//        dataType: 'json',
//        dataType: 'text',
        async: false
    }).responseText;
    
    console.log("result="+result);
//    console.log("typeof(result)="+typeof(result));
//    console.log("result[0]="+result[0]);

    return result;
  }
  
  static id_check(idname) {

    return(document.getElementById(idname));
  
  }
  
  static id2idx(id) {
  
    return(Number($("#"+id).attr("index")));
  
  }
  
  static getdata2var(uri,varname) {
  
    Palette.file_get_contents(uri+"?rdata="+Math.random(), (ret) => {
      let com = "var " + varname + ' = `' + ret + '`';
      window.eval(com);
    });
  
  }
  
  static toHalfWidth(str) {
    // 全角英数字を半角に変換
    
//    console.log("toHalfWidth str="+str);
    
    str = str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });


    str = str.replaceAll("＋","+");
    str = str.replaceAll("－","-");
    str = str.replaceAll("−","-");
    str = str.replaceAll("ー","-");
    str = str.replaceAll("‐","-");
    str = str.replaceAll("―","-");
    str = str.replaceAll("−","-");
    str = str.replaceAll("ｰ","-");
    str = str.replaceAll("＊","*");
    str = str.replaceAll("／","/");
    
    return str;
  }
  
  static isEarlier(str1, str2) {
    function parseDate(str) {
        const regex = /(\d+)年(\d+)月(\d+)日(\d+)時(\d+)分(\d+)秒/;
        const match = str.match(regex);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // 月は0から始まる
            const day = parseInt(match[3], 10);
            const hour = parseInt(match[4], 10);
            const minute = parseInt(match[5], 10);
            const second = parseInt(match[6], 10);
            return new Date(year, month, day, hour, minute, second);
        } else {
            throw new Error('無効な日時の形式です');
        }
    }

    const date1 = parseDate(str1);
    const date2 = parseDate(str2);

    return date1 < date2;
  }


}

Palette.fetchText = async function(url, callback) {

    const response = await fetch(url, {mode:'cors', cache: "no-cache"});
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const encoding = Encoding.detect(uint8Array);

    // Shift-JISからUnicodeへ変換
//    const unicodeArray = Encoding.convert(uint8Array, 'UNICODE', 'SJIS');
    // Unicodeへ変換
    const unicodeArray = Encoding.convert(uint8Array, 'UNICODE', encoding);
    
    // Unicode配列を文字列に変換
    const text = Encoding.codeToString(unicodeArray);
//    return text;
    return callback ? callback(text) : text;
}


Palette.file_get_contents = async function(uri, callback) {
    let res = await fetch(uri, {mode:'cors', cache: "no-cache"});
        ret = await res.text(); 
    return callback ? callback(ret) : ret; // a Promise() actually.
}



/*
Palette.getfiledata = async function(filename) {
  let rval = await Palette.file_get_contents("https://v133-18-239-183.vir.kagoya.net/file/dashtest1/"+filename+"?rdata="+Math.random());
  if (typeof ret !== "undefined") {
    console.log("s2 ret="+ret);
    rval = eval("[" +ret.trim()+ "]");
    console.log("s3 ret="+ret);
    console.log("rval="+rval);
    return(rval);
  }
}
*/

/*
Palette.getfileraw = async function(uri) {
  Palette.file_get_contents(uri+"?rdata="+Math.random()).then(ret => {
    console.log("ret="+ret);
    if (typeof ret !== "undefined") {
      return(ret.text());
    }
  });
}
*/

/*
async function file_get_contents(uri, callback) {
    let res = await fetch(uri, {mode:'cors', cache: "no-cache"});
        ret = await res.text(); 
    return callback ? callback(ret) : ret; // a Promise() actually.
}
*/

class Palette_Body_ME {

  static mode = "edit";

  static move;
  static body;
  static eraser;
  
  static target;

  static pt;
  static ppt;
  
  static mouse_down_in;
  static mouse_rel_x;
  static mouse_rel_y;

  static move_width = 50;
  static move_height = 50;

  static pt_left;
  static pt_top; 
  static eraser_width = 30;
  static eraser_height = 30;
  
  constructor(elm,selector,x,y,targetjq,classname)  {
  	
    let index = Palette.look_for_index_num(classname);
    
    let s = Palette.split_selector(selector);
    
    let moveval = '';
    
    let idtag = '';

    if (s.id.length>0) {
      if (Palette.id_check((s.id)[0])) {
        alert("ERROR: id "+(s.id)[0]+" is already used.");
        return;
      }
      if (s.id.length>1) {
        alert("ERROR: More than one id has been specified.");
        return;
      } else if (!(Palette.check_for_id((s.id)[0]))) {
        alert("ERROR: id " + (s.id)[0] +" is already in use.");
        return;
      } else {
        idtag = 'id="' + (s.id)[0] + '"';
        moveval = 'i: '+(s.id)[0];
      }
    }

    let classtag = `class = "palette body top ` + classname;
    
//    console.log('classtag1 = '+classtag);
    
    if (s.class.length>0) {
      if (moveval=='') {
        moveval = moveval + " c: ";
      } else {
        moveval = moveval + "\n c: ";
      }
    }
    
    s.class.forEach(e => {
      classtag = classtag + ' ' + e;
      moveval = moveval + e + ' ';
    });
    
    classtag = classtag + '"';
    moveval = moveval.trim();
    
    let src = `
    <div ` + idtag + ` ` + classtag + ` index=`+index+` style="top: ` + y + `px; left: ` + x + `px; position: absolute;">
    </div>
`;

//    let element = $(src).appendTo('#'+divname);
    let element;
    if ((typeof elm) == "string") {
       element = $(src).appendTo("#"+elm);
     } else {
       element = $(src).appendTo(elm);
    }

    let target = targetjq.appendTo(element);
    
    let move_y = -Palette_Body.move_height;
    let srcmove = `
      <input type="button" class="palette body move ` + classname + `" value="` + moveval + `" 
      style="position: absolute; width: `+Palette_Body.move_width+`px; height: `+Palette_Body.move_height+`px; top: ` + move_y + `px; left: 0px;">
`;
    let move = $(srcmove).appendTo(element);
    
//    let eraser_x = body_width - Palette_Body.eraser_width;
    let eraser_x = Palette_Body_ME.move_width
    let eraser_y = -Palette_Body.eraser_height;
    let srceraser = `
      <input type="button" class="palette body eraser ` + classname + `" value="x" 
      style="position: absolute; width: `+Palette_Body_ME.eraser_width+`px; height: `+Palette_Body_ME.eraser_height+`px; top: ` + eraser_y + `px; left: `+eraser_x+`px; padding: 0px; font-size: 11px">
`;
    let eraser = $(srceraser).appendTo(element);
    
    return element;
    
  }


}


class Palette_Compound_EditPanel extends Palette_Body_ME {

  static classname = 'comp_edit';
  
  constructor(divname,selector,x,y) {
  	
  	let classname = Palette_Compound_EditPanel.classname;

  	let index = Palette.look_for_index_num(classname);
  	
  	let elmsrc = `
  	
 <table border="1" width="200" style="background-color: white;">
    <tr align="center">
      <th>操作</th>
      <th>要素</th>
    </tr>
    <tr  align="center">
      <td><input type="button" value="include" onclick="Palette_Compound.include_element(this)"></td>
      <td><input type="text" class="elm" size=8></td>
    </tr>
    <tr  align="center">
      <td><input type="button" value="exclude" onclick="Palette_Compound.exclude_element(this)"></td>
      <td><input type="text" class="elm" size=8></td>
    </tr>
    <tr  align="center">
      <td><input type="button" value="copy" onclick="Palette_Compound.copy(this,this.parentElement.parentElement.querySelector('.elm').value)"></td>
      <td><input type="text" class="elm" size=8></td>
    </tr>
    <tr  align="center">
     <td><input type="button" value="register" onclick="Palette_Compound.register(this,this.parentElement.parentElement.querySelector('.cname').value)"></td> 
      <td><input type="text" class="cname" size=8></td>
    </tr>
    <tr  align="center">
     <td><input type="button" value="export" onclick="Palette_Compound.export(this,this.parentElement.parentElement.querySelector('.cname').value)"></td> 
      <td><input type="text" class="cname" size=8></td>
    </tr>
    <tr  align="center">
      <td>edit</td>
      <td class="compoundtag"></td>
    </tr>
  </table>
`;

    let epjq = $(elmsrc);
  	let element = super(divname,selector,x,y,epjq,classname);
  	element.attr("index",index);

  	return element;
  	
  }
  
}


class Palette_Body {

  static mode = "edit";

  static move;
  static body;
  static eraser;
  static size;
  static edit;
  static texta;
  static exe;
  
  static target;

  static pt;
  static ppt;
  static pppt;
  
  static mouse_down_in;
  static mouse_rel_x;
  static mouse_rel_y;

  static move_width = 50;
  static move_height = 50;

  static pt_left;
  static pt_top; 
  static eraser_width = 30;
  static eraser_height = 30;
  static size_width = 30;
  static size_height = 30;
  static edit_width = 30;
  static edit_height = 30;
  static exe_width = 30;
  static exe_height = 30;
  
  constructor(divname,selector,x,y,body_width,body_height,targetjq,classname)  {
  
    console.log("constructor Body");
  	
    let index = Palette.look_for_index_num(classname);
    
    let s = Palette.split_selector(selector);
    
    let moveval = '';
    
    let idtag = '';

    if (s.id.length>0) {
      if (Palette.id_check((s.id)[0])) {
        alert("ERROR: id "+(s.id)[0]+" is already used.");
        return;
      }
      if (s.id.length>1) {
        alert("ERROR: More than one id has been specified.");
        return;
      } else if (!(Palette.check_for_id((s.id)[0]))) {
        alert("ERROR: id " + (s.id)[0] +" is already in use.");
        return;
      } else {
        idtag = 'id="' + (s.id)[0] + '"';
        moveval = 'i: '+(s.id)[0];
      }
    }

    let classtag = `class = "palette body top ` + classname;
    
//    console.log('classtag1 = '+classtag);
    
    if (s.class.length>0) {
      if (moveval=='') {
        moveval = moveval + " c: ";
      } else {
        moveval = moveval + "\n c: ";
      }
    }
    
    s.class.forEach(e => {
      classtag = classtag + ' ' + e;
      moveval = moveval + e + ' ';
    });
    
//    console.log('classtag2 = '+classtag);
    
    classtag = classtag + '"';
    moveval = moveval.trim();
    
//    console.log('classtag3 = '+classtag);
    
/*
    let idname1 = idname.replace(/\s+/g,'')
    let idtag;
  	
  	if (idname1=='') {
  	  idtag = '';
  	} else {
  	  idtag = 'id="Palette_' + idname1 + '"';
  	}

    let src = `
    <div ` + idtag + ` class="palette body top ` + classname + `" index=`+index+` style="top: ` + y + `px; left: ` + x + `px; position: absolute;">
    </div>
`;
*/

    let src = `
    <div ` + idtag + ` ` + classtag + ` index=`+index+` style="top: ` + y + `px; left: ` + x + `px; position: absolute;">
    </div>
`;

    console.log('src='+src);
    
    let element = $(src).appendTo('#'+divname);
    let target = targetjq.appendTo(element);
    
    let move_y = -Palette_Body.move_height;
    let srcmove = `
      <input type="button" class="palette body move ` + classname + `" value="` + moveval + `" 
      style="position: absolute; width: `+Palette_Body.move_width+`px; height: `+Palette_Body.move_height+`px; top: ` + move_y + `px; left: 0px;">
`;
    let move = $(srcmove).appendTo(element);
    
    let eraser_x = body_width - Palette_Body.eraser_width;
    let eraser_y = -Palette_Body.eraser_height;
    let srceraser = `
      <input type="button" class="palette body eraser ` + classname + `" value="x" 
      style="position: absolute; width: `+Palette_Body.eraser_width+`px; height: `+Palette_Body.eraser_height+`px; top: ` + eraser_y + `px; left: `+eraser_x+`px; padding: 0px; font-size: 11px">
`;
    let eraser = $(srceraser).appendTo(element);

    let size_x = body_width-Palette_Body.size_width;
    let size_y = body_height;
    
    let srcsize = `
      <input type="button" class="palette body size ` + classname + `" value="s" 
      style="position: absolute; width: `+Palette_Body.size_width+`px; height: `+Palette_Body.size_height+`px; top: ` + size_y + `px; left: ` + size_x + `px; padding: 0px; font-size: 11px">
`;
    let size = $(srcsize).appendTo(element);
    
    let edit_y = body_height;
    
    let srcedit = `
      <input type="button" class="palette body edit ` + classname + `" value="e" 
      style="position: absolute; width: `+Palette_Body.edit_width+`px; height: `+Palette_Body.edit_height+`px; top: `+edit_y+`px; left: 0px; padding: 0px; font-size: 11px">
`;
    let edit = $(srcedit).appendTo(element);

    let exe_x = -Palette_Body.exe_width;
    if ((classname == 'text2')||(classname == 'fraction')) {
      exe_x = body_width;
    }
    let exe_y = 0;
    let srcexe = `
      <input type="button" class="palette body exe ` + classname + `" value="j" 
      style="position: absolute; width: `+Palette_Body.exe_width+`px; height: `+Palette_Body.exe_height+`px; top: `+exe_y+`px; left: `+exe_x+`px; padding: 0px; font-size: 11px">
`;
    let exe = $(srcexe).appendTo(element);
    

    let srctexta = `
      <textarea class="palette body texta ` + classname + `" rows="20" cols="80" value="" head="0" 
      style="position: absolute; top: 0px; left: ` + body_width + `px; resize: both;">
`;
    let texta = $(srctexta).appendTo(element);
    
    texta.hide();
    
    return element;
    
  }

}


class Palette_Img extends Palette_Body {

  static classname = 'img';
  
  constructor(divname,selector,x,y,imgjq) {
  	
  	let classname = Palette_Img.classname;
	let width = imgjq.width();
	let height = imgjq.height();

  	let index = Palette.look_for_index_num(classname);

  	let element = super(divname,selector,x,y,width,height,imgjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top body "+classname);
  	
  	let target = element.find('.palette.img.target');
  	target.css("height","auto");

  	return element;
  	
  }
  
}

class Palette_Text extends Palette_Body {

  static classname = 'text';
  static height = 30;
  static text_height = 25;
  
  constructor(divname,selector,x,y,width) {
  	
  	let classname = Palette_Text.classname;
  	let height = Palette_Text.height;

  	let index = Palette.look_for_index_num(classname);

  	let srctext = `
      <input type="text" class="palette ` + classname + ` target" style="position: absolute; height: ` + Palette_Text.text_height + `px; width: ` + width + `px; top: 0px; left: 0px;">
`;
	let textjq = $(srctext);

//	console.log('textjq.prop("outerHTML")='+textjq.prop("outerHTML"));

  	let element = super(divname,selector,x,y,width,height,textjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);
  	
  	let size = element.find(".size");
  	size.attr("class","palette body size " + classname);

/*
  	let body = element.find(".target");
  	body.css("height","auto");
*/

  	return element;
  	
  }
  
}

class Palette_Spreadsheet extends Palette_Body {

  static classname = 'spreadsheet';
  static width = Palette_Body.move_width+Palette_Body.eraser_width;
  static height = Palette_Body.exe_height;
  static obj = [];

  constructor(divname,selector,x,y,row,col) {
  	
  	let classname = Palette_Spreadsheet.classname;
  	let height = Palette_Spreadsheet.height;
  	let width = Palette_Spreadsheet.width;

  	let index = Palette.look_for_index_num(classname);

  	let srctext = `
  	  <div id="spread_sheet_` + index + `" class="jexcel_container palette body target spreadsheet">
  	  </div>
`;
	let textjq = $(srctext);

  	let element = super(divname,selector,x,y,width,height,textjq,classname);
  	element.attr("index",index);

  	let size = element.find(".size");
  	size.remove();
  	
  	let edit = element.find(".edit");
  	edit.css({ left: '-' + Palette_Body.edit_width + 'px'});

  	let texta = element.find(".texta");
  	texta.css({ top: Palette_Body.exe_height + 'px'});
  	
    console.log("row="+row+", col="+col);
    let js = element.find('.jexcel_container')[0];
    let m = Number(row);
    let n = Number(col);

    let i, ar=[];
        
    for (i=0;i<m;i++) {
      ar.push(new Array(n).fill(""));
    }

    Palette_Spreadsheet.obj[index] = jspreadsheet(js, {
      data: ar
    });

  	return element;
  }
  
  static server2this(url) {
  
    let idx = getidx();
    
    let data = Palette_Spreadsheet.obj[idx].getData();
    let row = data.length;
    let id;
  
    for (let i=0;i<row;i++) {
      id = data[i][0];
      if (id.trim() !== "") {
        Palette_Spreadsheet.file2this(url+id,idx,1,i);
      }
    }
  }
  
  
  static file2this(file,idx,xoffset,yoffset) {

    
    Palette.file_get_contents(file+"?rdata="+Math.random(), (ret) => {
      let rar = ret.trim().split(",");
      for (let j=0; j<rar.length; j++) {
        console.log("j="+j+", ret[j]="+ret[j]);
        Palette_Spreadsheet.obj[idx].setValueFromCoords(xoffset+j,yoffset,Number(rar[j]),true);
      }
    });
  
  }
  
  static split(str) {
  
    return(str.split(","));
  
  }
  
  static serverfile2this(uri) {

    let idx = getidx();
    let i,j;
    let data;
    let line;
    let maxcol = -1;
    
    Palette.fetchText(uri+"?rdata="+Math.random(), (ret) => {
      let lines = ret.trim().split("\n");
      let sdata = Palette_Spreadsheet.obj[idx].getData();
      let row = sdata.length;
      for (i=0;i<row;i++) {
        if (maxcol < sdata[i].length) {
          maxcol = sdata[i].length;
        }
      }
      let llen = lines.length;
      if (row < llen) {
        Palette_Spreadsheet.obj[idx].insertRow(llen-row)
      }
      for (i=0; i<llen; i++) {
        data = Palette_Spreadsheet.split(lines[i]);
        for (j=0; j<maxcol; j++) {
          if (j<data.length) {
            Palette_Spreadsheet.obj[idx].setValueFromCoords(j,i,data[j],true);
          } else {
            Palette_Spreadsheet.obj[idx].setValueFromCoords(j,i,"",true);
          }
        }
      }
    });  

  
  }
  
  
  static parseCSV(str) {
  
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    let csvString = str.trim();

    while (i < csvString.length) {
        const char = csvString[i];
        const nextChar = csvString[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote inside quoted field
                currentField += '"';
                i++; // Skip the next quote
            } else {
                // Toggle inQuotes status
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator outside quotes
            currentRow.push(currentField);
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            // Line break outside quotes
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
        } else {
            // Regular character
            currentField += char;
        }
        i++;
    }

    // Add the last field and row if any
    currentRow.push(currentField);
    rows.push(currentRow);

    return rows;
  }
  
  
  static update(spreadsheet, csvdata) {
    // Determine the number of rows and columns in the CSV data
    const numRows = csvdata.length;
    const numCols = Math.max(...csvdata.map(row => row.length));

    // Get the current number of rows and columns in the spreadsheet
    const currentData = spreadsheet.getData();
    const currentRows = currentData.length;
    const currentCols = currentData[0] ? currentData[0].length : 0;

    // Adjust the number of rows
    if (currentRows < numRows) {
        // Add rows
        spreadsheet.insertRow(numRows - currentRows);
    } else if (currentRows > numRows) {
        // Delete rows from the end
        for (let i = currentRows - 1; i >= numRows; i--) {
            spreadsheet.deleteRow(i);
        }
    }

    // Adjust the number of columns
    if (currentCols < numCols) {
        // Add columns
        spreadsheet.insertColumn(numCols - currentCols);
    } else if (currentCols > numCols) {
        // Delete columns from the end
        for (let i = currentCols - 1; i >= numCols; i--) {
            spreadsheet.deleteColumn(i);
        }
    }

    // Populate the spreadsheet with the CSV data
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const value = csvdata[row][col] !== undefined ? csvdata[row][col] : '';
            spreadsheet.setValueFromCoords(col, row, value);
        }
    }

    // Refresh the spreadsheet to reflect changes
    spreadsheet.refresh();
  }
  
  static datacolmns(index) {

    let rawdata, colwidth, w, ct="", cols, j,  ncol;  
    
    if (!((typeof Palette_Spreadsheet.obj[index]) === 'undefined')) {
	  cols = [];
	  rawdata = Palette_Spreadsheet.obj[index].getData();
	  ncol = rawdata[0].length;
	  cols.push({width: (Palette_Spreadsheet.obj[index].getWidth(0))[0] });
	  for (j=1; j<ncol; j++) {
	    cols.push({width: Palette_Spreadsheet.obj[index].getWidth(j)});
	  }
	  return([rawdata,cols]);
	} else {
	  alert("ERROR: Palette_Spreadsheet.datacolmns() index="+index);
	}
	
  }
  
  static register_menu(elm,classname,datastr,colstr) {
  
    console.log("Palette_Spreadsheet.register elm = "+elm.prop("outerHTML"));
    let sdom,index;
    
    elm.find("."+classname).each((i,e) => {
      index = e.getAttribute("index");
      sdom = document.getElementById("spread_sheet_"+index);
      sdom.innerHTML = "";
      Palette_Spreadsheet.obj[Number(index)] = jspreadsheet(sdom, {data:datastr, columns: colstr});
      console.log("Palette_Spreadsheet.register_menu index="+index);
    });
  
  }
  
  static columnLetterToIndex(columnLetter) {
  
    let column = columnLetter.toUpperCase();
    let index = 0;
    for (let i = 0; i < column.length; i++) {
      index *= 26;
      index += column.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return index - 1; // Convert to zero-based index
    
  }

  static applyToCells(idx, func, rowOrColumn) {
    // Helper function to convert column letters to zero-based index
    
    let obj = Palette_Spreadsheet.obj[idx];

    if (/^[A-Za-z]+$/.test(rowOrColumn)) {
        // The string specifies a column
        let columnIndex = Palette_Spreadsheet.columnLetterToIndex(rowOrColumn);
        let numRows = obj.options.data.length;
        for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
            let value = obj.getValueFromCoords(columnIndex, rowIndex);
            let newValue = func(value);
            obj.setValueFromCoords(columnIndex, rowIndex, newValue);
        }
    } else if (/^[0-9]+$/.test(rowOrColumn)) {
        // The string specifies a row
        let rowIndex = parseInt(rowOrColumn, 10) - 1; // Convert to zero-based index
        let numCols = obj.options.columns.length;
        for (let columnIndex = 0; columnIndex < numCols; columnIndex++) {
            let value = obj.getValueFromCoords(columnIndex, rowIndex);
            let newValue = func(value);
            obj.setValueFromCoords(columnIndex, rowIndex, newValue);
        }
    } else {
        throw new Error("Invalid row or column specifier. Please provide a valid row number or column letter.");
    }
  }

  static arrangeData(index, str1, func1, str2, func2) {
  
    // Helper function to convert column letters to zero-based index
    
    let jsobj = Palette_Spreadsheet.obj[index];

    const colIndex1 = Palette_Spreadsheet.columnLetterToIndex(str1);
    const colIndex2 = Palette_Spreadsheet.columnLetterToIndex(str2);
    let data = jsobj.options.data;
    

    // Sort the data based on colIndex1 using func1
    data.sort(function(rowA, rowB) {
        const valA = rowA[colIndex1];
        const valB = rowB[colIndex1];
        if (func1(valA, valB)) {
            return -1; // valA comes before valB
        } else if (func1(valB, valA)) {
            return 1; // valB comes before valA
        } else {
            return 0; // valA and valB are considered equal
        }
    });

    let newData = [];
    let currentGroupValue = null;
    let groupRows = [];

    for (let i = 0; i < data.length; i++) {
        let row = data[i];
        let val = row[colIndex1];
        if (currentGroupValue === null || val !== currentGroupValue) {
            // Process the previous group
            if (groupRows.length > 0) {
                // Keep only the row with the maximum value in colIndex2 according to func2
                let maxRow = groupRows[0];
                let maxVal = maxRow[colIndex2];
                for (let j = 1; j < groupRows.length; j++) {
                    let candidateRow = groupRows[j];
                    let candidateVal = candidateRow[colIndex2];
                    if (func2(candidateVal, maxVal)) {
                        maxRow = candidateRow;
                        maxVal = candidateVal;
                    }
                }
                newData.push(maxRow);
            }
            // Start a new group
            currentGroupValue = val;
            groupRows = [row];
        } else {
            // Same group, add the row to the group
            groupRows.push(row);
        }
    }

    // Process the last group
    if (groupRows.length > 0) {
        let maxRow = groupRows[0];
        let maxVal = maxRow[colIndex2];
        for (let j = 1; j < groupRows.length; j++) {
            let candidateRow = groupRows[j];
            let candidateVal = candidateRow[colIndex2];
            if (func2(candidateVal, maxVal)) {
                maxRow = candidateRow;
                maxVal = candidateVal;
            }
        }
        newData.push(maxRow);
    }

    // Update the spreadsheet data
    jsobj.options.data = newData;

    // Refresh the spreadsheet display
    jsobj.refresh();
  }
  
  static hideUnwantedColumns(index, strs) {

    let obj = Palette_Spreadsheet.obj[index];
    
    let numCols = obj.options.columns.length;

    // Get the first row of data
    let firstRow = obj.options.data[0];

    for (let colIndex = 0; colIndex < numCols; colIndex++) {
        // Get the value in the first row of the current column
        let value = firstRow[colIndex];

        // If the value is not in the array of strings, hide the column
        if (!strs.includes(value)) {
            obj.hideColumn(colIndex);
        }
    }

  }

  static calcColAvg(index, colname) {
  
    let obj = Palette_Spreadsheet.obj[index];

/*
    console.log("calcColAvg index="+index);
    console.log("obj="+obj);
*/
    // 1. データの取得
    const data = obj.getData();
    
    if (data.length === 0) {
      throw new Error("スプレッドシートにデータがありません。");
     }

    // 2. 1行目（インデックス0）のデータを使用して列インデックスを見つける
    const firstRow = data[0];
    let colIndex = -1;

    for (let i = 0; i < firstRow.length; i++) {
      if (firstRow[i] === colname) {
        colIndex = i;
        break;
      }
    }

    if (colIndex === -1) {
      throw new Error(`指定された列名 '${colname}' が見つかりませんでした。`);
    }

    // 3. データの取得（2行目以降）
    let sum = 0;
    let count = 0;

    for (let row = 1; row < data.length; row++) {
      const value = data[row][colIndex];
      const num = parseFloat(value);
      if (!isNaN(num)) {
        sum += num;
        count++;
      }
//      console.log("row="+row+", num="+num+", sum="+sum+", count="+count);
    }

    if (count === 0) {
      return null; // 数値データがない場合は null を返す
    }

    const average = sum / count;
    return average;
  }
  

  static getCellValue(index, colname, id) {
  
    const obj = Palette_Spreadsheet.obj[index];
    // 1. データの取得
    const data = obj.getData();

    if (data.length === 0) {
        throw new Error("スプレッドシートにデータがありません。");
    }

    // 2. 1行目のデータから列インデックスを見つける
    const firstRow = data[0];
    let colIndex = -1;

    for (let j = 0; j < firstRow.length; j++) {
        if (firstRow[j] === colname) {
            colIndex = j;
            break;
        }
    }

    if (colIndex === -1) {
        throw new Error(`指定された列名 '${colname}' が見つかりませんでした。`);
    }

    // 3. 1列目のデータから行インデックスを見つける（1行目以降）
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) { // i = 1 から始める（1行目は列名）
        if (data[i][0] === id) {
            rowIndex = i;
            break;
        }
    }

    if (rowIndex === -1) {
        throw new Error(`指定されたID '${id}' が見つかりませんでした。`);
    }

    // 4. 指定されたセルの値を取得して返す
    const cellValue = data[rowIndex][colIndex];
    return cellValue;
  }

  static setData(index, ar) {
  
    const obj = Palette_Spreadsheet.obj[index];
    
    // 'ar' の行数と列数を取得
    const numRows = ar.length;
    const numCols = ar[0] ? ar[0].length : 0;
    
//    console.log("setData numRows="+numRows+", numCols="+numCols);

    // 現在のスプレッドシートの行数と列数を取得
    const currentData = obj.getData();
    const currentNumRows = currentData.length;
    const currentNumCols = currentData[0] ? currentData[0].length : 0;

//    console.log("setData currentNumRows="+currentNumRows+", currentNumCols="+currentNumCols);
    
    // 行数の調整
    if (currentNumRows < numRows) {
        // 行を追加
        obj.insertRow(numRows - currentNumRows, currentNumRows);
    } else if (currentNumRows > numRows) {
        // 余分な行を削除
        obj.deleteRow(numRows, currentNumRows - numRows);
    }

    // 列数の調整
    if (currentNumCols < numCols) {
        // 列を追加
        obj.insertColumn(numCols - currentNumCols, currentNumCols);
    } else if (currentNumCols > numCols) {
        // 余分な列を削除
        obj.deleteColumn(numCols, currentNumCols - numCols);
    }

    // データの設定
    obj.setData(ar);
  }


  static getColumnData(index, colname) {
  
    const obj = Palette_Spreadsheet.obj[index];
    
    // スプレッドシートの全データを取得
    const data = obj.getData();

    if (data.length === 0) {
        throw new Error("スプレッドシートにデータがありません。");
    }

    // 1行目から列インデックスを特定
    const firstRow = data[0];
    let colIndex = -1;

    for (let i = 0; i < firstRow.length; i++) {
        if (firstRow[i] === colname) {
            colIndex = i;
            break;
        }
    }

    if (colIndex === -1) {
        throw new Error(`指定された列名 '${colname}' が見つかりませんでした。`);
    }

    // 指定された列のデータを収集（1行目を除く）
    const columnData = [];

    for (let row = 1; row < data.length; row++) {
        columnData.push(data[row][colIndex]);
    }

    return columnData;
  }
  
  static getHiddenCols(index) {

    const obj = Palette_Spreadsheet.obj[index];
    
    const totalCols = obj.options.columns.length;
    const hidecol = new Array(totalCols).fill(false);

    for (let i = 0; i < totalCols; i++) {
        const colElement = obj.headers[i];
        if (colElement) {
            // ヘッダー要素のスタイルを取得して非表示状態を判定
            const isHidden = colElement.style.display === 'none' || colElement.style.visibility === 'hidden';
            hidecol[i] = isHidden;
        }
    }

    return hidecol;
    
  }



  static setHiddenCols(index, ar) {
  
    const obj = Palette_Spreadsheet.obj[index];
    
    // 'ar' は各列の非表示状態を示す配列
    // 各要素について、対応する列を非表示または表示します
    for (let i = 0; i < ar.length; i++) {
        if (ar[i]) {
            // 列を非表示にする
            obj.hideColumn(i);
        } else {
            // 列を表示する
            obj.showColumn(i);
        }
    }
    
  }



}



class Palette_Quill extends Palette_Body {

  static classname = 'quill';
  static width = 500;
  static height = 300;
  static obj = [];
  
  static toolbarOptions = [
['bold', 'italic', 'underline', 'strike'],        // toggled buttons
['blockquote', 'code-block'],

[{ 'header': 1 }, { 'header': 2 }],               // custom button values
[{ 'list': 'ordered' }, { 'list': 'bullet' }],
[{ 'script': 'sub' }, { 'script': 'super' }],      // superscript/subscript
[{ 'indent': '-1' }, { 'indent': '+1' }],          // outdent/indent
[{ 'direction': 'rtl' }],                         // text direction

[{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
[{ 'header': [1, 2, 3, 4, 5, 6, false] }],

[{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
[{ 'font': [] }],
[{ 'align': [] }],

["image"],

["formula"],

['clean']                                         // remove formatting button
    ];

  constructor(divname,selector,x,y,row,col) {

  	let classname = Palette_Quill.classname;
  	let height = Palette_Quill.height;
  	let width = Palette_Quill.width;

  	let index = Palette.look_for_index_num(classname);

  	let srctext = `
  	  <div id="palette_quill_` + index + `" class="palette body target quill">
  	  </div>
`;
	let textjq = $(srctext);

  	let element = super(divname,selector,x,y,width,height,textjq,classname);
  	element.attr("index",index);
  	element.css("width",width);
  	element.css("height",height);

/*
  	let size = element.find(".size");
  	size.remove();
  	
  	let edit = element.find(".edit");
  	edit.css({ left: '-' + Palette_Body.edit_width + 'px'});

  	let texta = element.find(".texta");
  	texta.css({ top: Palette_Body.exe_height + 'px'});
  	
    console.log("row="+row+", col="+col);
    let js = element.find('.jexcel_container')[0];
    let m = Number(row);
    let n = Number(col);

    let i, ar=[];
        
    for (i=0;i<m;i++) {
      ar.push(new Array(n).fill(""));
    }
*/
    Palette_Quill.obj[index] = new Quill('#palette_quill_'+index, {
      theme: 'snow',
      modules: {
        toolbar: Palette_Quill.toolbarOptions
      }
    });

  	return element;
  }
  
}

class Palette_Echart extends Palette_Body {

  static classname = 'echart';
  static width = 500;
  static height = 300;
  
  static obj = [];

  constructor(divname,selector,x,y,row,col) {
  	
  	let classname = Palette_Echart.classname;
  	let height = Palette_Echart.height;
  	let width = Palette_Echart.width;

  	let index = Palette.look_for_index_num(classname);

  	let srctext = `
  	  <div id="echart_` + index + `" class="echart_container palette body target echart" style="width: 500px;height:300px;">
  	  </div>
`;
	let textjq = $(srctext);

  	let element = super(divname,selector,x,y,width,height,textjq,classname);
  	element.attr("index",index);

/*
  	let size = element.find(".size");
  	size.remove();
  	
  	let edit = element.find(".edit");
  	edit.css({ left: '-' + Palette_Body.edit_width + 'px'});

  	let texta = element.find(".texta");
  	texta.css({ top: Palette_Body.exe_height + 'px'});
  	
    console.log("row="+row+", col="+col);
    let js = element.find('.jexcel_container')[0];
    let m = Number(row);
    let n = Number(col);

    let i, ar=[];
        
    for (i=0;i<m;i++) {
      ar.push(new Array(n).fill(""));
    }

    Palette_Echart.obj[index] = jspreadsheet(js, {
      data: ar
    });
*/

    Palette_Echart.obj[index] = echarts.init(document.getElementById("echart_" + index));
    console.log("Palette_Echart.obj = "+Palette_Echart.obj[index]);

  	return element;
  }
  
  static setOptionthis(option) {
  
   let idx = Number(Palette_Body.target.parentElement.getAttribute('index'));
   Palette_Echart.obj[idx].setOption(option);
   
  
  }
  
  static piechart(datavalue,dataname,title) {
  
    let option = {
      title: {
        text: '',
        left: 'center'
      },
      tooltip: {
        trigger: 'item'
      },
      series: [
        {
          name: 'Activities',
          type: 'pie',
          radius: '50%',
          data: [],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
    
    option.title.text = title;
    
    for (let i=0; i<datavalue.length; i++) {
      option.series[0].data.push({ value: datavalue[i], name: dataname[i] });
    }
    
    Palette_Echart.setOptionthis(option);
  
  }
  
  static spread2chart(spreadid,idxes,dataname,title,type) {
    
    Palette_Echart.spreadidx2chart(Palette.id2idx(spreadid),idxes,dataname,title,type)
  
  }
  
  static spreadidx2chart(sidx,idxes,dataname,title,type) {
  
    let sdata = Palette_Spreadsheet.obj[sidx].getData();
    let datavalue = [];
    
    for (let i=0; i<idxes.length; i++) {
      datavalue.push(sdata[idxes[i][0]][idxes[i][1]]);
    }
    
    console.log("datavalue="+datavalue);
    
    if (type=="pie") {
      Palette_Echart.piechart(datavalue,dataname,title);
    } else if (type == "bar") {
      Palette_Echart.barchart(datavalue,dataname,title);
    } else {
      alert("spread2chart unknown type : "+type);
    }
  
  }

  static barchart(datavalue,dataname,title) {
  
    let option = {
      title: {
        text: ''
      },
      tooltip: {
        trigger: 'item'
      },
      yAxis: {
        type: 'category',
        data: []
      },
      xAxis: {
        type: 'value'
      },
      series: [
        {
          name: '',
          type: 'bar',
          data: []
        }
      ]
    };
    
    option.title.text = title;
    
    option.yAxis.data = dataname.reverse();
    option.series[0].data = datavalue.reverse();
    
    Palette_Echart.setOptionthis(option);
  
  }
  
}

Palette_Echart.size_mouseup = function(e) {

  let t = e.target.parentNode.querySelector(".target");
  let w = t.style.width;
  let h = t.style.height;
  let tn = $(t);
  tn.children("div").css({width: w, height: h});
  tn.find("canvas").css({width: w, height: h});

}



class Palette_Timer extends Palette_Body {

  static classname = 'timer';
  static height = 30;
  static text_height = 25;
  
  constructor(divname,selector,x,y,width,min,sec) {
  	
  	let classname = Palette_Timer.classname;
  	let height = Palette_Timer.height;

  	let index = Palette.look_for_index_num(classname);

  	let srctext = `
  	  <div class="palette ` + classname + ` target" style="position: absolute; height: ` + Palette_Timer.text_height + `px; width: ` + width + `px; top: 0px; left: 0px;">
  	  <span class="timer_min">` + min + `</span>分<span class="timer_sec">` + sec + `</span>秒
      </div>
`;
	let textjq = $(srctext);

//	console.log('textjq.prop("outerHTML")='+textjq.prop("outerHTML"));

  	let element = super(divname,selector,x,y,width,height,textjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);
  	
  	let size = element.find(".size");
//  	size.attr("class","palette body size " + classname);
    console.log("element = "+element.prop("outerHTML"));
    size.hide();

/*
  	let body = element.find(".target");
  	body.css("height","auto");
*/

    element.find(".timer_min").html(min);
    element.find(".timer_sec").html(sec);
    
    element.attr("min",min);
    element.attr("sec",sec);

  	return element;
  	
  }
  
}

Palette_Timer.countdown = function(e) {

//  console.log("countdown e="+e.outerHTML);
  
  let sec = e.querySelector('.target .timer_sec');
  let min = e.querySelector('.target .timer_min');
  
  let csec = Number(sec.innerHTML);
  let cmin = Number(min.innerHTML);
  if (cmin==0 && csec==1) {
    sec.innerHTML = 0;
    eval(e.querySelector('.timer.texta').innerHTML);
    let ti = Number(e.getAttribute("ti"));
    clearInterval(ti);
//    console.log("2 ti="+ti);
    return;
  }
  if (csec==0) {
    cmin = cmin-1;
    csec = 59;
  } else {
    csec = csec-1;
  }

  min.innerHTML = cmin;
  sec.innerHTML = csec;
  
}

Palette_Timer.starttimer = function(e) {

//  console.log("starttimer e="+e.outerHTML);
  let min = e.getAttribute("min");
  let sec = e.getAttribute("sec");
  e.querySelector('.target .timer_sec').innerHTML = sec;
  e.querySelector('.target .timer_min').innerHTML = min;
  let ti = setInterval(function() { Palette_Timer.countdown(e);},1000);
  e.setAttribute("ti",ti);
//  console.log("1 ti="+ti);

}

Palette_Timer.startalltimers = function() {

  $(".timer.top").each((i,e) => {
    Palette_Timer.starttimer(e);
  });

}

class Palette_Text2 extends Palette_Body {

  static classname = 'text2';
  static height = 30;
  static text_height = 25;
  
  constructor(divname,selector,x,y,width) {
  	
  	let classname = Palette_Text2.classname;
  	let height = Palette_Text2.height;

  	let index = Palette.look_for_index_num(classname);

  	let srctext = `
      <input type="text" class="palette ` + classname + ` target" style="position: absolute; height: ` + Palette_Text.text_height + `px; width: ` + width + `px; top: 0px; left: 0px;">
`;
	let textjq = $(srctext);

//	console.log('textjq.prop("outerHTML")='+textjq.prop("outerHTML"));

  	let element = super(divname,selector,x,y,width,height,textjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);
  	
  	let size = element.find(".size");
  	size.attr("class","palette body size " + classname);

/*
  	let body = element.find(".target");
  	body.css("height","auto");
*/

  	return element;
  	
  }
  
}



class Palette_Button extends Palette_Body {

  static classname = 'button';
  static height = 30;
  static width = 120;
  
  constructor(divname,selector,x,y) {
  	
  	let classname = Palette_Button.classname;
  	let height = Palette_Button.height;
  	let width = Palette_Button.width;
  	let idtag;

  	let index = Palette.look_for_index_num(classname);

  	let srctarget = `
      <input type="button" `+idtag+` class="palette ` + classname + ` target exe" style="position: absolute; width: ` + width + `px; height: ` + height + `px; top: 0px; left: 0px;">
`;
	let targetjq = $(srctarget);
	
 	let element = super(divname,selector,x,y,width,height,targetjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);

  	let size = element.find(".size");
//	size.attr("class","palette size body " + classname);
	size.addClass(classname);
	
  	let exe= element.find('.exe:not(".target")');
  	exe.remove();

  	return element;
  	
  }
  
}

Palette.move_mousedown = function(e) {
  
  Palette_Body.pt = e.target.parentNode;
  
  Palette_Body.ppt = Palette_Body.pt.parentNode;
  
  Palette_Body.mouse_down_in = true;

  if (Palette_Body.ppt.classList.contains('compound')) {
    console.log("contains compound");
    Palette_Body.mouse_rel_x = e.offsetX + Palette.px2num(Palette_Body.ppt.style.left);
    Palette_Body.mouse_rel_y = e.offsetY - Palette_Body.move_height + Palette.px2num(Palette_Body.ppt.style.top);
  } else {
    console.log("not contains compound");
    Palette_Body.mouse_rel_x = e.offsetX;
    Palette_Body.mouse_rel_y = e.offsetY - Palette_Body.move_height;
  }

/*
  Palette_Body.mouse_rel_x = 0;
  Palette_Body.mouse_rel_y = 0;
*/

  console.log("Palette.move_mousedown Palette_Body.mouse_rel_x="+Palette_Body.mouse_rel_x);
  console.log("Palette.move_mousedown Palette_Body.mouse_rel_y="+Palette_Body.mouse_rel_y);
  
}

Palette.move_mousemove = function(e) {

  if (Palette_Body.mouse_down_in) {

    let ey = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop);
    let ex = (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft);

    Palette_Body.pt.style.top =  ey + 'px';
    Palette_Body.pt.style.left =  ex + 'px';

  }
  
}

Palette.move_mouseup_mouseout = function(e) {

  if (Palette_Body.mouse_down_in) {
    Palette_Body.mouse_down_in = false; 
  }
  
}

Palette.eraser_mousedown = function(e) {

  e.target.parentElement.remove();
  
}

Palette_Body.size_mousedown = function(e) {

  console.log("Palette_Body.size_mousedown");

  Palette_Body.mouse_down_in = true;

  let et = e.target;
    	
  Palette_Body.pt = et.parentNode;
  Palette_Body.ppt = Palette_Body.pt.parentNode;
  
//  console.log("pt="+Palette_Body.pt.outerHTML);
//  console.log("ppt="+Palette_Body.ppt.outerHTML);
  
  if (Palette_Body.ppt.classList.contains('compound')) {
    Palette_Body.mouse_rel_x = e.offsetX  - Palette_Body.size_width + Palette.px2num(Palette_Body.ppt.style.left);
    Palette_Body.mouse_rel_y = e.offsetY + Palette.px2num(Palette_Body.ppt.style.top);
  } else {
    Palette_Body.mouse_rel_x = e.offsetX - Palette_Body.size_width;
    Palette_Body.mouse_rel_y = e.offsetY;
  }
  
  Palette_Body.pt_left =  Number(Palette_Body.pt.style.left.replace('px','')); 
  Palette_Body.pt_top = Number(Palette_Body.pt.style.top.replace('px',''));

/*
  Palette_Body.target = et.parentNode.querySelector('.palette.target');
  Palette_Body.eraser = et.parentNode.querySelector('.palette.eraser');
  Palette_Body.edit = et.parentNode.querySelector('.palette.edit');
  Palette_Body.texta = et.parentNode.querySelector('.palette.texta');
  Palette_Body.exe = et.parentNode.querySelector('.palette.exe');
*/

  Palette_Body.target = Palette_Body.pt.querySelector('.palette.target');
  Palette_Body.eraser = Palette_Body.pt.querySelector('.palette.eraser');
  Palette_Body.edit = Palette_Body.pt.querySelector('.palette.edit');
  Palette_Body.texta = Palette_Body.pt.querySelector('.palette.texta');
  Palette_Body.exe = Palette_Body.pt.querySelector('.palette.exe');
  
  Palette_Body.target2 = Palette_Body.pt.querySelector('.palette.target2');
  Palette_Body.target3 = Palette_Body.pt.querySelector('.palette.target3');

/*
  console.log('Palette_Body.target='+Palette_Body.target.outerHTML);
  console.log('Palette_Body.eraser='+Palette_Body.eraser.outerHTML);
  console.log('Palette_Body.edit='+Palette_Body.edit.outerHTML);
*/
  
}



Palette_Body.size_mousemove = function(e) {

  console.log("Palette_Body.size_mousemove");

  if (Palette_Body.mouse_down_in) {

    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);
    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);

/*
    let buttom = (e.clientY - Palette_Body.mouse_rel_y - document.body.scrollTop - Palette_Body.pt_top);
    let right =  (e.clientX - Palette_Body.mouse_rel_x - document.body.scrollTop - Palette_Body.pt_left);
*/

/*
    console.log("e.clientY="+e.ClientY);
    console.log("Palette_Body.mouse_rel_y="+Palette_Body.mouse_rel_y);
    console.log("document.body.scrollTop="+document.body.scrollTop);
    console.log("Palette_Body.pt_top="+Palette_Body.pt_top)
    console.log("buttom="+ buttom);
*/
    
    e.target.style.top = (buttom) + 'px';
    e.target.style.left = Math.max((right - Palette_Body.size_width), Palette_Body.edit_width) + 'px';

    Palette_Body.target.style.width = right + 'px';
    Palette_Body.target.style.height = buttom + 'px';

//    Palette_Body.eraser.style.left = (right-Palette_Body.eraser_width) + 'px';
    Palette_Body.eraser.style.left = Math.max((right-Palette_Body.eraser_width),Palette_Body.move_width) + 'px';
    Palette_Body.edit.style.top = buttom + 'px';
    Palette_Body.texta.style.left = (right) + 'px';

 }
 
}


Palette_Body.size_mouseup_mouseout = function(e) {
	
  if (Palette_Body.mouse_down_in) {
    Palette_Body.mouse_down_in = false; 
  }

}

Palette.edit_mousedown = function(e) {
  	
  let texta = e.target.parentNode.querySelector('.palette.texta');
  
  if (texta.style.display=="none") {
    texta.style.display = "block";
    e.target.style.backgroundColor = "#808080";
  } else {
    texta.style.display= "none";
    e.target.style.backgroundColor = "#f0f0f0";
  }

}

Palette.exe_mousedown = function(e) {

//  alert("exe mousedown");
  let etp = e.target.parentNode;
  Palette_Body.target =  etp.querySelector('.target');
//  alert(etp.querySelector('.palette.texta').value);
  eval(etp.querySelector('.palette.texta').value);
  
}

Palette_Img.size_mousemove = function(e) {

  console.log("Palette_Img size mousemove");
  
  if (Palette_Body.mouse_down_in) {

    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);

    Palette_Body.target.style.width = right + 'px';
//    Palette_Body.body.style.height = buttom + 'px';

//    Palette_Body.eraser.style.left = (right-Palette_Body.eraser_width) + 'px';
      Palette_Body.eraser.style.left = Math.max((right-Palette_Body.eraser_width), Palette_Body.move_width) + 'px';

    Palette_Body.texta.style.left = (right) + 'px';

//    e.target.style.left = (right - Palette_Body.size_width) + 'px';
    e.target.style.left = Math.max((right - Palette_Body.size_width),Palette_Body.edit_width) + 'px';
//    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);

//    let buttom = (Palette_Body.body.height  - Palette_Body.mouse_rel_y + document.body.scrollTop);
//    let buttom = (Palette_Body.target.height + document.body.scrollTop);
    let buttom = Palette_Body.target.height;
    Palette_Body.edit.style.top = buttom + 'px';
    e.target.style.top = (buttom) + 'px';


 }
 
}

Palette_Text.size_mousemove = function(e) {

  if (Palette_Body.mouse_down_in) {

    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);

    Palette_Body.target.style.width = right + 'px';
//    Palette_Body.body.style.height = buttom + 'px';

//    Palette_Body.eraser.style.left = (right-Palette_Body.eraser_width) + 'px';
    Palette_Body.eraser.style.left = Math.max((right-Palette_Body.eraser_width), Palette_Body.move_width) + 'px';
    Palette_Body.texta.style.left = (right) + 'px';

//    e.target.style.left = (right - Palette_Body.size_width) + 'px';
    e.target.style.left = Math.max((right - Palette_Body.size_width),Palette_Body.edit_width) + 'px';
//    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);

//    let buttom = (Palette_Body.body.height  - Palette_Body.mouse_rel_y + document.body.scrollTop);
/*
    let buttom = (Palette_Body.body.height + document.body.scrollTop);
    Palette_Body.edit.style.top = buttom + 'px';
    e.target.style.top = (buttom) + 'px';
*/


 }
 
}





Palette_Text2.size_mousemove = function(e) {

  if (Palette_Body.mouse_down_in) {

    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);

    Palette_Body.target.style.width = right + 'px';
//    Palette_Body.body.style.height = buttom + 'px';

    Palette_Body.eraser.style.left = Math.max((right-Palette_Body.eraser_width), Palette_Body.move_width) + 'px';
    Palette_Body.texta.style.left = (right) + 'px';
    
    Palette_Body.exe.style.left = (right) + 'px';

//    e.target.style.left = (right - Palette_Body.size_width) + 'px';
    console.log("Palette_Body.edit_width="+Palette_Body.edit_width);
    e.target.style.left = Math.max((right - Palette_Body.size_width),Palette_Body.edit_width) + 'px';
    console.log("e.target.style.left="+e.target.style.left);
//    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);

//    let buttom = (Palette_Body.body.height  - Palette_Body.mouse_rel_y + document.body.scrollTop);
/*
    let buttom = (Palette_Body.body.height + document.body.scrollTop);
    Palette_Body.edit.style.top = buttom + 'px';
    e.target.style.top = (buttom) + 'px';
*/

 }
 
}





Palette_Button.size_mousemove = function(e) {

  if (Palette_Body.mouse_down_in) {

    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);
    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);

    e.target.style.top = (buttom) + 'px';
//    e.target.style.left = (right - Palette_Body.size_width) + 'px';
    e.target.style.left = Math.max((right - Palette_Body.size_width),Palette_Body.edit_width) + 'px';
    
    Palette_Body.target.style.width = right + 'px';
    Palette_Body.target.style.height = buttom + 'px';

//    Palette_Body.eraser.style.left = (right-Palette_Body.eraser_width) + 'px';
//    console.log("right="+right+", Palette_Body.size_width="+Palette_Body.size_width+",+Palette_Body.move_width="+Palette_Body.move_width);
    Palette_Body.eraser.style.left = Math.max((right-Palette_Body.eraser_width),Palette_Body.move_width) +  'px';
    Palette_Body.edit.style.top = buttom + 'px';
    Palette_Body.texta.style.left = (right) + 'px';

 }
 
}

Palette_Compound_EditPanel.move_mousedown = function(e) {
  
  Palette_Body.pt = e.target.parentNode;
  
  Palette_Body.pppt = Palette_Body.pt.parentNode.parentNode;
  
  Palette_Body.mouse_down_in = true;

//  if (Palette_Body.ppt.classList.contains('compound')) {
    Palette_Body.mouse_rel_x = e.offsetX + Palette.px2num(Palette_Body.pppt.style.left);
    Palette_Body.mouse_rel_y = e.offsetY - Palette_Body.move_height + Palette.px2num(Palette_Body.pppt.style.top);
//   } else {

/*

    Palette_Body.mouse_rel_x = e.offsetX;
    Palette_Body.mouse_rel_y = e.offsetY - Palette_Body.move_height;
*/
    
  console.log("Palette_Compound_EditPanel.move_mousedown Palette_Body.mouse_rel_x="+Palette_Body.mouse_rel_x);
  console.log("Palette_Compound_EditPanel.move_mousedown Palette_Body.mouse_rel_y="+Palette_Body.mouse_rel_y);
//  }
  
}

class Palette_Radio extends Palette_Body {

  static classname = 'radio';
  static height = 50;
  static width = 120;
  static content_height = 30;
  static content_width = 30;

  constructor(divname,selector,x,y,str) {
  	
  	let classname = Palette_Radio.classname;
  	let height = Palette_Radio.height;
  	let width = Palette_Radio.width;

  	let index = Palette.look_for_index_num(classname);
  	
  	let radioname = "Palette_radio_"+index;

  	let srctarget = `
      <div class="palette ` + classname + ` target" style="position: absolute; width: ` + width + `px; height: ` + height + `px; top: 0px; left: 0px;">
`;
    let sa = str.split(',').map(e => e.trim());
    for(let i=0;i<sa.length;i++) {
    	srctarget += '\n' + '<input type="radio" name="'+radioname+'" value="'+sa[i]+'" >'+sa[i] + '&nbsp;';
}
    srctarget += '\n</div>\n';
    
    console.log('srctarget='+srctarget);

	let targetjq = $(srctarget);
	
  	let element = super(divname,selector,x,y,width,height,targetjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);

  	let size = element.find(".size");
//	size.attr("class","palette size body " + classname);
	size.addClass(classname);

  	return element;
  	
  }
  
}



class Palette_Pulldown extends Palette_Body {

  static classname = 'pulldown';
  static height = 20;
  static width = 80;
  static content_height = 30;
  static content_width = 30;

  constructor(divname,selector,x,y,str) {
  	
  	let classname = Palette_Pulldown.classname;
  	let height = Palette_Pulldown.height;
  	let width = Palette_Pulldown.width;

  	let index = Palette.look_for_index_num(classname);
  	
  	let pulldownname = "Palette_pulldown_"+index;

  	let srctarget = `
      <div class="palette ` + classname + ` target" style="position: absolute; width: ` + width + `px; height: ` + height + `px; top: 0px; left: 0px;">
`;

    srctarget += '<select name="' + pulldownname + '">';
    srctarget += '\n' + '<option value="0"></option>';
    
    let sa = str.split(',').map(e => e.trim());
    for(let i=0;i<sa.length;i++) {
        srctarget += '\n' + '<option value="' + String(i+1) + '">' + sa[i] + '</option>';
    }
    
    srctarget += '\n</select>\n</div>\n';
    
    console.log('srctarget='+srctarget);

	let targetjq = $(srctarget);
	
  	let element = super(divname,selector,x,y,width,height,targetjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);

  	let size = element.find(".size");
  	size.remove();

  	return element;
  	
  }
  
}

class Palette_File extends Palette_Body {

  static classname = 'file';
  static height = 30;
  static width = 300;
  static text = [];
  static targetindex;
  static filename = [];
  
  constructor(divname,selector,x,y) {
  	
  	let classname = Palette_File.classname;
  	let height = Palette_File.height;
  	let width = Palette_File.width;
  	let idtag;

  	let index = Palette.look_for_index_num(classname);

  	let srctarget = `
      <input type="file" `+idtag+` class="palette ` + classname + ` target" style="position: absolute; width: ` + width + `px; height: ` + height + `px; top: 0px; left: 0px;">
`;
	let targetjq = $(srctarget);
	
 	let element = super(divname,selector,x,y,width,height,targetjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);

  	let size = element.find(".size");
//	size.attr("class","palette size body " + classname);
	size.addClass(classname);
	
  	let exe= element.find('.exe:not(".target")');
  	exe.remove();

  	return element;
  	
  }
  
  static register(idx) {
  
//    alert("Palette_File register idx="+idx);
  
    const filesel = '.palette.body.top.file[index="' + idx + '"] > input[type="File"]';
    
    $(filesel).on('change', function(e) {
      if ($(filesel).val() !== '') { 
        const file = e.target.files[0];
        const filename = file.name;
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
   
        reader.onload = function(event) {
          const arrayBuffer = event.target.result;
          const uint8Array = new Uint8Array(arrayBuffer);
          const encoding = Encoding.detect(uint8Array);
          // Unicodeへ変換
          const unicodeArray = Encoding.convert(uint8Array, 'UNICODE', encoding);
          // Unicode配列を文字列に変換
          const text = Encoding.codeToString(unicodeArray);
          Palette_File.text[Number(idx)] = text;
          Palette_File.targetindex = Number(idx);
          eval($('.palette.body.top.file[index="'+idx+'"] > textarea').val());
          $('.palette.body.top.file[index="'+idx+'"]').attr('filename',filename);
//          alert("regsiter :  filename = "+filename);
//          $(filesel).val('');
        };
      }
    });
  
  }
  
  static register_menu(elm,classname) {
  
//    alert("Palette_File register_menu classname="+classname);
  
    let index;
    
    elm.find("."+classname).each((i,e) => {
      index = e.getAttribute("index");
      console.log("Palette_File.register_menu index="+index);
      Palette_File.register(index);
    });
  
  }
  
  static get_text() {
  
//    console.log("Palette_File.targetindex = "+Palette_File.targetindex);
    
    return(Palette_File.text[Palette_File.targetindex]);
    
  }
  
  static thisjq() {
  
    return($('.palette.body.top.file[index="'+Palette_File.targetindex+'"]'));
    
  }
  
}

class Palette_Fraction extends Palette_Body {

  static classname = 'fraction';
  static height = 61;
  static width = 70;
  static content_height = 30;
  static content_width = 30;
  static text_height = 25;
  static text_height2 = 30;
  static text_height3 = 37;
  
  constructor(divname,selector,x,y,str) {
  	
  	let classname = Palette_Fraction.classname;
  	let height = Palette_Fraction.height;
  	let width = Palette_Fraction.width;

  	let index = Palette.look_for_index_num(classname);
  	
  	let fractionname = "Palette_fraction_"+index;

  	let srctarget = `
      <div class="palette ` + classname + ` visible" style="position: absolute; top: 0px; left: 0px;">
`;


    srctarget += '<table name="' + fractionname + '">';

    srctarget += `
  <tr>
    <td><input type="text" class="palette ` + classname + ` target bunshi" style="position: absolute; height: ` + Palette_Fraction.text_height + `px; width: ` + width + `px; top: 0px; left: 0px;"></td>
</tr>
<td><hr class="palette target2" size="1px" style="position: absolute; height: ` + 1 + `px; width: ` + width + `px; top: ` + 22 + `px; left: 0px;"></td>
<tr>
    <td><input type="text" class="palette ` + classname + ` target3 bunbo" style="position: absolute; height: ` + Palette_Fraction.text_height + `px; width: ` + width + `px; top: ` + Palette_Fraction.text_height3 + `px; left: 0px;"></td>
  </tr>
</table>
`;
    
    console.log('srctarget='+srctarget);

	let targetjq = $(srctarget);
	
  	let element = super(divname,selector,x,y,width,height,targetjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);

/*
  	let size = element.find(".size");
  	size.remove();
*/

  	return element;
  	
  }
  
}


Palette_Fraction.size_mousemove = function(e) {

  if (Palette_Body.mouse_down_in) {

    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);

    Palette_Body.target.style.width = right + 'px';
//    Palette_Body.body.style.height = buttom + 'px';

    Palette_Body.target2.style.width = right + 'px';
    Palette_Body.target3.style.width = right + 'px';

//    Palette_Body.eraser.style.left = (right-Palette_Body.eraser_width) + 'px';
    Palette_Body.eraser.style.left = Math.max((right-Palette_Body.eraser_width), Palette_Body.move_width) + 'px';
    Palette_Body.texta.style.left = (right) + 'px';
    
    Palette_Body.exe.style.left = (right) + 'px';

//    e.target.style.left = (right - Palette_Body.size_width) + 'px';
    e.target.style.left = Math.max((right - Palette_Body.size_width),Palette_Body.edit_width) + 'px';
//    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);

//    let buttom = (Palette_Body.body.height  - Palette_Body.mouse_rel_y + document.body.scrollTop);
/*
    let buttom = (Palette_Body.body.height + document.body.scrollTop);
    Palette_Body.edit.style.top = buttom + 'px';
    e.target.style.top = (buttom) + 'px';
*/


 }
 
}


class Palette_TextArea extends Palette_Body {

  static classname = 'textarea';
  static height = 50;
  static width = 120;

  
  constructor(divname,selector,x,y) {
  	
  	let classname = Palette_TextArea.classname;
  	let height = Palette_TextArea.height;
  	let width = Palette_TextArea.width;

  	let index = Palette.look_for_index_num(classname);

  	let srctarget = `
      <textarea class="palette ` + classname + ` target" style="position: absolute; width: ` + width + `px; height: ` + height + `px; top: 0px; left: 0px; resize: both;">
`;
	let targetjq = $(srctarget);
	
  	let element = super(divname,selector,x,y,width,height,targetjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);

  	let size = element.find(".size");
//	size.attr("class","palette size body " + classname);
	size.addClass(classname);

  	return element;
  	
  }
  
}


class Palette_iframe extends Palette_Body {

  static classname = 'iframe';
  static height = 300;
  static width = 400;

  
  constructor(divname,selector,url,x,y) {
  	
  	let classname = Palette_iframe.classname;
  	let height = Palette_iframe.height;
  	let width = Palette_iframe.width;

  	let index = Palette.look_for_index_num(classname);

  	let srctarget = `
      <iframe class="palette ` + classname + ` target" src = "` + url + `" style="position: absolute; width: ` + width + `px; height: ` + height + `px; top: 0px; left: 0px;">
`;
	let targetjq = $(srctarget);
	
  	let element = super(divname,selector,x,y,width,height,targetjq,classname);
  	element.attr("index",index);
//  	element.attr("class","palette top "+classname);

  	let size = element.find(".size");
//	size.attr("class","palette size body " + classname);
	size.addClass(classname);

  	return element;
  	
  }
  
}

Palette_iframe.size_mousemove = function(e) {

  console.log("Palette_iframe.size_mousemove");

  if (Palette_Body.mouse_down_in) {

    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);
    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);
    
    console.log("buttom="+buttom+", right="+right);

    e.target.style.top = (buttom) + 'px';
//    e.target.style.left = (right - Palette_Body.size_width) + 'px';
    e.target.style.left = Math.max((right - Palette_Body.size_width),Palette_Body.edit_width) + 'px';
    
    Palette_Body.target.style.width = right + 'px';
    Palette_Body.target.style.height = buttom + 'px';

//    Palette_Body.eraser.style.left = (right-Palette_Body.eraser_width) + 'px';
//    console.log("right="+right+", Palette_Body.size_width="+Palette_Body.size_width+",+Palette_Body.move_width="+Palette_Body.move_width);
    Palette_Body.eraser.style.left = Math.max((right-Palette_Body.eraser_width),Palette_Body.move_width) +  'px';
    Palette_Body.edit.style.top = buttom + 'px';
    Palette_Body.texta.style.left = (right) + 'px';

 }
 
}

class Palette_Markdown extends Palette_Body {

  static classname = 'markdown';
  static height = 380;
  static width = 560;
  static content_height = 30;
  static content_width = 30;
  static content_left = - 30;
  static content_top = Palette_Markdown.height;
  static content;
  static wmd_input;
  
  static converter = [];
  static editor = [];
  static mjpd = [];
  
  constructor(divname,selector,x,y) {
  	
  	let classname = Palette_Markdown.classname;
  	let height = Palette_Markdown.height;
  	let width = Palette_Markdown.width;

  	let index = Palette.look_for_index_num(classname);
  	
  	let num,maxnum=0;
  	
    $("div.palette.top.markdown").each((i,e) => {
      num = Number(e.getAttribute('suffix').replace(/_suffix_/,""));
      if (maxnum < num) {
        maxnum = num;
      }
    });
  	
  	let customsuffix = '_suffix_'+(maxnum+1);

  	let srctarget = `
       <div class="palette markdown visible" style="margin-left: auto; margin-right: auto; position: absolute; top: 0px; left: 0px;">
            <div id="wmd-button-bar` + customsuffix + `" class="wmd-button-bar" style="display: none;"></div>
            <div id="wmd-preview` + customsuffix + `" class="wmd-preview palette markdown target" style="width: ` + Palette_Markdown.width + `px; height: ` + Palette_Markdown.height + `px; margin-left: auto; position: absolute; top: 0px; left: 0px; background-color: #fff;"></div>
        </div>

`;
	let targetjq = $(srctarget);
	
  	let element = super(divname,selector,x,y,width,height,targetjq,classname);
  	element.attr("index",index);
  	element.attr("suffix",customsuffix);
//  	element.attr("class","palette top "+classname);

  	let size = element.find(".size");
//	size.attr("class","palette size body " + classname);
	size.addClass(classname);
	
    let srctexta = `
      <textarea class="palette body texta wmd-input ` + classname + `" rows="20" cols="80" value="" head="0" 
      id="wmd-input`+ customsuffix  + `" style="position: absolute; top: 0px; left: ` + width + `px; display: none;">
`;

    let texta = $(srctexta).appendTo(element);

/*
    let textasrc = $(srctexta).appendTo(element);

  	let texta = element.find(".texta");
//	size.attr("class","palette size body " + classname);
	texta.addClass(classname);
	texta.addClass('wmd-input');
//	texta.id = "wmd-input-customsuffix";
    texta.attr("id","wmd-input"+customsuffix);
*/

    let srccontent = `
      <input type="button" class="palette body content ` + classname + `" value="c" 
      style="position: absolute; width: `+Palette_Markdown.content_width+`px; height: `+Palette_Markdown.content_height+`px; 
      top: `+Palette_Markdown.content_top+`px; left: `+Palette_Markdown.content_left +`px; padding: 0px; font-size: 11px">
`;
    let content = $(srccontent).appendTo(element);
    
    Palette_Markdown.starteditor(customsuffix);
  	return element;
  	
  }
  
}



Palette_Markdown.starteditor = function(uniqueEditorSuffix) {

  let idx = Number(uniqueEditorSuffix.replace(/_suffix_/,""));
  
  console.log("starteditor idx="+idx);


                // create a new Markdown converter and Markdown editor associated with
                //  the input textarea and the preview div
//                var converter1 = Markdown.getSanitizingConverter();

                Palette_Markdown.converter[idx] = new Markdown.Converter();  // nonsanitized editor
                
// console.log("starteditor step1");
 
                Palette_Markdown.editor[idx] = new Markdown.Editor(Palette_Markdown.converter[idx], uniqueEditorSuffix);
                
// console.log("starteditor step2");
 
                // coordinate the Markdown editor with MathJax rendering via MJPDEditing
                
                Palette_Markdown.mjpd[idx] = new MJPD();  // create a new MJPD for each editor on the page
                
// console.log("starteditor step3");
 
                 Palette_Markdown.mjpd[idx].Editing.prepareWmdForMathJax(Palette_Markdown.editor[idx], uniqueEditorSuffix, [["$", "$"]]);
                
// console.log("starteditor step4");
 
                // start rendering
                
                console.log("starteditor uniqueEditorSuffix="+uniqueEditorSuffix);
                
                Palette_Markdown.editor[idx].run();


}

/*

Palette_Markdown.starteditor = function(uniqueEditorSuffix) {

//                var uniqueEditorSuffix = '-customsuffix';
// console.log("starteditor uniqueEditorSuffix="+uniqueEditorSuffix);

                // create a new Markdown converter and Markdown editor associated with
                //  the input textarea and the preview div
//                var converter1 = Markdown.getSanitizingConverter();

                var converter1 = new Markdown.Converter();  // nonsanitized editor
                
// console.log("starteditor step1");
 
                var editor1 = new Markdown.Editor(converter1, uniqueEditorSuffix);
                
// console.log("starteditor step2");
 
                // coordinate the Markdown editor with MathJax rendering via MJPDEditing
                
                var mjpd1 = new MJPD();  // create a new MJPD for each editor on the page
                
// console.log("starteditor step3");
 
                mjpd1.Editing.prepareWmdForMathJax(editor1, uniqueEditorSuffix, [["$", "$"]]);
                
// console.log("starteditor step4");
 
                // start rendering
                
                console.log("starteditor uniqueEditorSuffix="+uniqueEditorSuffix);
                
                editor1.run();


}

*/

Palette_Markdown.content_mousedown = function(e) {
	
  let wmd = e.target.parentNode.querySelector('.palette.wmd-input');

  
  if (wmd.style.display=="none") {
    e.target.style.backgroundColor = "#808080";
    e.target.parentNode.querySelector('.palette.edit').style.backgroundColor = "#f0f0f0";
    e.target.parentNode.querySelector('.palette.texta:not(.wmd-input)').style.display = "none";
    wmd.style.display = "block";
  } else {
    wmd.style.display= "none";
    e.target.style.backgroundColor = "#f0f0f0";
  }
}

Palette_Markdown.edit_mousedown = function(e) {
  	
  let texta = e.target.parentNode.querySelector('.palette.texta:not(.wmd-input)');
  
  if (texta.style.display=="none") {
    texta.style.display = "block";
    e.target.style.backgroundColor = "#808080";
    e.target.parentNode.querySelector('.palette.content').style.backgroundColor = "#f0f0f0";
    e.target.parentNode.querySelector('.palette.wmd-input').style.display = "none";
  } else {
    texta.style.display= "none";
    e.target.style.backgroundColor = "#f0f0f0";
  }

}

Palette_Markdown.startalleditors = function() {

//  console.log('startalleditors');

  $(".palette.top.markdown").map(function(index, element) {
    Palette_Markdown.starteditor(element.getAttribute('suffix'));
  });
  
}


Palette_Markdown.size_mousedown = function(e) {

  Palette_Body.size_mousedown(e);
  
  let et = e.target;
  
  Palette_Markdown.content = et.parentNode.querySelector('.palette.content');
  Palette_Markdown.wmd_input = et.parentNode.querySelector('.palette.wmd-input');
  
}


Palette_Markdown.size_mousemove = function(e) {

  Palette_Body.size_mousemove(e);
  
  if (Palette_Body.mouse_down_in) {
  
    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);
    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);
    
    Palette_Markdown.content.style.top = buttom + 'px';
    Palette_Markdown.wmd_input.style.left = (right) + 'px';
    
  }

}

/*
    function upload_image(ts,divname) {


    console.log('uploadFile2');

        var file = ts.files[0];


        if (file.type.indexOf("image") < 0) {
            alert("画像ファイルを指定してください。");
            return false;
        }

        var reader = new FileReader();
        reader.onload = ((file) => {
            return  (e) => {
                image2(e.target.result,divname);
                console.log('file loaded');
            };
        })(file);
        reader.readAsDataURL(file);
    ;}
    
    
  function image2(src,divname) {
  
    var img = new Image();

    img.onload = () => {

		let scale = img.naturalHeight/img.naturalWidth;
		img.style.width = "300px";
		img.style.height = (Math.round(300*scale))+'px';
		img.style.position = "absolute";
		img.style.top = "0px";
		img.style.left = "0px";
		img.style.border = "solid";
		img.classList.add("palette");
		img.classList.add("body");
		img.classList.add("target");
		img.classList.add("img");
		let element = new Palette_Img(divname,400,35,$(img));
		return element;
     };

     img.src = src;
    
    
  }
*/

// class Palette_Compound extends Palette {
class Palette_Compound {

  static move_width = 50;
  static move_height = 50;
  static edit_width = 30;
  static edit_height = 30;
  static eraser_width = 30;
  static eraser_height = 30;
  static init_elm_width = 100;
  static init_elm_height = 50;
  
  static cmenu = {};

  static classname = 'compound';

  static delete_menu(menu) {

    $('select.compound_menu option[value='+menu+']').remove();
    delete Palette_Compound.cmenu[menu];
  
  }
  
  constructor(divname,selector,x,y,elm) {
  
    console.log("compound constructor elm="+elm);
    console.log("compound constructor divname="+divname);
    console.log("compound constructor selector="+selector);
    
  	let classname = Palette_Compound.classname;
  	let index = Palette.look_for_index_num(classname);
  	let move_width = Palette_Compound.move_width;
  	let move_height = Palette_Compound.move_height;
  	let edit_width = Palette_Compound.edit_width;
  	let edit_height = Palette_Compound.edit_height;
  	let init_elm_width = Palette_Compound.init_elm_height;
  	let init_elm_height = Palette_Compound.init_elm_height;
//  	let panel_width = Palette_Compound.edit_width;
//  	let panel_height = Palette_Compound.edit_height;
  	
    let s = Palette.split_selector(selector);
    
    console.log("compound constructor selector="+selector+", s="+JSON.stringify(s));

    
    let moveval = '';
    
    let idtag = '';
    let idname = '', classnamelist = [];

    if (s.id.length>0) {
      if (Palette.id_check((s.id)[0])) {
        alert("ERROR: id "+(s.id)[0]+" is already used.");
        return;
      }
      if (s.id.length>1) {
        alert("ERROR: More than one id has been specified.");
        return;
      } else if (!(Palette.check_for_id((s.id)[0]))) {
        alert("ERROR: id " + (s.id)[0] +" is already in use.");
        return;
      } else {
        idname = (s.id)[0];
        idtag = 'id="' + idname + '"';
        moveval = 'i: '+idname;
        
      }
    }

    let classtag = `class = "palette top ` + classname;
    
    if (s.class.length>0) {
      if (moveval=='') {
        moveval = moveval + " c: ";
      } else {
        moveval = moveval + "\n c: ";
      }
    }
    
    s.class.forEach(e => {
      classtag = classtag + ' ' + e;
      moveval = moveval + e + ' ';
      classnamelist.push(e);
    });
    classtag = classtag + '"';
    moveval = moveval.trim();
    
    let element;
    
//    if (elm.match(/^\s*\<div[\s\S]+\<\/div\>$/) === null) {  // メニューから Compound を選んだ場合
    if (!(elm instanceof jQuery)) {  // メニューから Compound を選んだ場合

      console.log("Compound constructor from Compound");
    
      let src = `
      <div ` + idtag + ` ` + classtag + ` index=`+index+` style="top: ` + y + `px; left: ` + x + `px; position: absolute;">
      </div>
`;

      element = $(src).appendTo('#'+divname);
    
      console.log('elm='+elm);

//      let ae = $(elm);
      let ae = $('.top_layer').children(elm);
      let ae1,aepos,newcx,newcy;
    
      console.log('ae='+ae);
    
      ae.each(function(i,e) {
    
        ae1 = $(e);
        console.log("e="+JSON.stringify(e));
        aepos = ae1.position();
        newcx = Number(aepos.left)-Number(x);
        newcy = Number(aepos.top)-Number(y);
        ae1.appendTo(element);
        ae1.css("left",newcx);
        ae1.css("top",newcy);
        ae1.css("z-index",i);
//        ae1.children(':not(.target,.visible)').hide();
        console.log('top='+ae1.css("top")+', left='+ae1.css("left")+', x='+x+', y='+y);
        console.log('moveval='+moveval);
    
      });

      let init_elm_x = 100;
      let init_elm_y = 0;
      let display;

      if (Palette.debug) {
        display = "";
      } else {
        display = "display: none;";
      }

      let srcinit_elm = `
<textarea class="palette compound init_elm ` + classname + `" 
style="position: absolute; width: `+Palette_Compound.init_elm_width+`px; height: `+Palette_Compound.init_elm_height+`px; top: ` + init_elm_y + `px; left: `+init_elm_x+`px; resize: both;` + display + `">
</textarea>
`;
      
      let init_elm = $(srcinit_elm).appendTo(element);
      
    } else {  //  メニューから Compound menu を選んだ場合

      console.log("Compound constructor from Compound menu");

      if (idname != '') {
        elm.attr('id',idname);
      }
      classnamelist.forEach(e => elm.addClass(e));

//      console.log("eval(elm.outerHTML) = "+eval("elm.prop('outerHTML')"));
//      element = $(elm).appendTo('#'+divname);

      element = elm.appendTo('#'+divname);

      elm.find(".init_elm").each((i,e) => {
      
        eval($(e).val());
      
      });
      
    }
    
    console.log("compound constructor element="+element.prop("outerHTML"));
    
    let move_y = -move_height;
    let srcmove = `
      <input type="button" class="palette move ` + classname + `" value="` + moveval + `" 
      style="position: absolute; width: `+move_width+`px; height: `+move_height+`px; top: ` + move_y + `px; left: 0px;">
`;
    let move = $(srcmove).appendTo(element);

    let edit_y = -edit_height;
    let edit_x = move_width;
    let srcedit = `
      <input type="button" class="palette comp_edit ` + classname +  `"
      style="position: absolute; width: `+edit_width+`px; height: `+edit_height+`px; top: ` + edit_y + `px; left: ` + edit_x + `px;" 
      onclick="Palette_Compound_EditPanel.toggle_display(this); Palette_Compound.pickup_element(this);">
`;
    let edit = $(srcedit).appendTo(element);
    
    let edit_panel_y = 0;
    let edit_panel_x = edit_x;
//    let edit_panel_x = 0;
    
    let srcepanel = `
      <div class="palette edit_panel ` + classname +  `"
      style="position: absolute; top: ` + edit_panel_y + `px; left: 0px; display: none; z-index: 100;">
      </div>
`;

    let edit_panel = $(srcepanel).appendTo(element);
    
    let eraser_x = edit_panel_x+edit_width;
    let eraser_y = -Palette_Compound.eraser_height;
    let srceraser = `
      <input type="button" class="palette compound eraser ` + classname + `" value="x" 
      style="position: absolute; width: `+Palette_Compound.eraser_width+`px; height: `+Palette_Compound.eraser_height+`px; top: ` + eraser_y + `px; left: `+eraser_x+`px; padding: 0px; font-size: 11px">
`;
    let eraser = $(srceraser).appendTo(element);
    
    return(element);


  }
  
}


Palette_Compound_EditPanel.toggle_display = function(th) {


  let ep = th.parentElement.querySelector(".edit_panel.compound");
  console.log("Palette_Compound_EditPanel.toggle_display ep = "+ep.outerHTML);
  
  let q = ep.querySelector("table");
  
  
  if (q===null) {
    new Palette_Compound_EditPanel(ep,".edit_panel_table",100,100);
    $(ep).show();
    console.log("ep="+ep.outerHTML);
//    $(nep).appendTo($(ep));
  } else {
    Palette.toggle_display(ep);
  
  
  }


}

Palette_Compound.register = function(elm,cname) {

  console.log("register cname="+cname);

  if (cname.match(/^\s*$/)) {
    alert("ERROR: register()  要素名が指定されていません!");
    return(0);
  }
  
  let jc = elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
  
  jc.querySelectorAll('.palette.texta').forEach( e => {
    e.innerHTML = e.value;
  });
  
  let data,cols,cn,cr="",com="";
  
  jc.querySelectorAll('.palette.top.spreadsheet').forEach( e => {
    [data,cols] = Palette_Spreadsheet.datacolmns(Number(e.getAttribute("index")));
    cn =  Palette_Compound.pickup_nonname(e.getAttribute("class"));
    if (cn == "") {
      alert("ERROR: Palette_Compound constructor!! spreadsheet element does not have unique classname");
      return;
    }
    com = com + cr + 'Palette_Spreadsheet.register_menu(elm,"'+cn+'",'+JSON.stringify(data)+','+JSON.stringify(cols)+');';
    cr = "\n";
  });
  
  jc.querySelectorAll('.palette.top.file').forEach( e => {
    cn =  Palette_Compound.pickup_nonname(e.getAttribute("class"));
    if (cn.trim() == "") {
      alert("ERROR: Palette_Compound.register class name for file is not defined!!");
      return;
    }
    com = com + cr + 'Palette_File.register_menu(elm,"'+cn+'");';
    cr = "\n";
  });
  
  if (com != "") {
    let jcinit = jc.querySelector(".palette.compound.init_elm");
    jcinit.innerHTML = jcinit.innerHTML + com;
  }

//  let jcsrc = $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
  let jcsrc = $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
//  let jcsrc = structuredClone($(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML));
  
  let pl = 100;
  let pt = 100;

  jcsrc.css("top",String(pt)+"px");
  jcsrc.css("left",String(pl)+"px");
  
  jcsrc.find("div.wmd-button-bar > .wmd-button-row").remove();
  jcsrc.find("div.wmd-preview > p").remove();
  
  jcsrc.find("div.edit_panel.compound").remove();
  
  jcsrc.find("input.palette.move.compound").remove();
  jcsrc.find("input.palette.comp_edit.compound").remove();
  jcsrc.find("input.palette.eraser.compound").remove();

  jcsrc.find("div.palette.score").remove();
  
  Palette_Compound.cmenu[cname] = jcsrc.prop("outerHTML");
//  console.log("Palette_Compound.cmenu[cname]="+ Palette_Compound.cmenu[cname]);

/*
  let index;
  let rawdata, jsdata, colwidth, w, ct="", cols, j,  ncol;
  
  jcsrc.find(".palette.spreadsheet.top").each((i,pb) => {
    index = Number(pb.getAttribute('index'));
    if (!((typeof Palette_Spreadsheet.obj[index]) === 'undefined')) {
	  cols = [];
	  rawdata = Palette_Spreadsheet.obj[index].getData();
	  ncol = rawdata[0].length;
	  jsdata = JSON.stringify(rawdata);
	  cols.push({width: (Palette_Spreadsheet.obj[index].getWidth(0))[0] });
	  for (j=1; j<ncol; j++) {
	    cols.push({width: Palette_Spreadsheet.obj[index].getWidth(j)});
	  };
	  ct = ct + 'var sdom = document.getElementById("spread_sheet_'+index+'");\n';
	  ct = ct + 'sdom.innerHTML = "";\n';
	  ct = ct + 'Palette_Spreadsheet.obj['+index+'] = jspreadsheet(sdom, {data:'+jsdata+', columns: ' + JSON.stringify(cols) + '});\n';	 
	}
  });
  
  Palette_Compound.ccom[cname] = ct;
  console.log("register ct="+ct);
*/

  $(".menu .compound_menu").append('<option value="'+cname+'">'+cname+'</option>');

}

Palette_Compound.export = function(elm,cname) {

  if (cname.match(/^\s*$/)) {
    alert("ERROR: export() 要素名が指定されていません!");
    return(0);
  }
  
//  let jc = elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
  let jc = elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
  
  jc.querySelectorAll('.palette.texta').forEach( e => {
    e.innerHTML = e.value;
  });
  
//  let jcsrc = $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
  let jcsrc = $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
  
  console.log("jcsrc="+elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
  
  let pl = 100;
  let pt = 100;

  jcsrc.css("top",String(pt)+"px");
  jcsrc.css("left",String(pl)+"px");
  
  jcsrc.find("div.wmd-button-bar > .wmd-button-row").remove();
  jcsrc.find("div.wmd-preview > p").remove();
  
//  jcsrc.find(".edit_panel.compound > table").remove();
  jcsrc.find("div.edit_panel.compound").remove();
  
  jcsrc.find("input.palette.move.compound").remove();
  jcsrc.find("input.palette.comp_edit.compound").remove();
  jcsrc.find("input.palette.eraser.compound").remove();
  
  jcsrc.find("div.palette.score").remove();
//  Palette.handleDownload2(JSON.stringify(jcsrc.prop("outerHTML")),cname+".cpd");
  Palette.handleDownload2(JSON.stringify(jcsrc.prop("outerHTML")),cname+".cpd");

}


Palette_Compound.import_compound_menu = function(divname,input) {

  Object.keys(input.files).forEach(i => {
    const reader = new FileReader();
  
    reader.onload = () => {
/*
      jcsrc = $(JSON.parse(reader.result));
      Palette_Compound.cmenu[cname] = jcsrc.prop("outerHTML");
*/
      Palette_Compound.cmenu[cname] = JSON.parse(reader.result);
      $(".menu .compound_menu").append('<option value="'+cname+'">'+cname+'</option>');
    }

    const file = input.files[i];
    const cname = file.name.replace(/\.cpd$/,"").replace(/\.cds$/,"");
    reader.readAsText(file);
  });

}

Palette_Compound.copy = function(elm,selector) {
  
  let jc = elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;

  jc.querySelectorAll('.palette.texta').forEach( e => {
    e.innerHTML = e.value;
  });
  
  
//  let jcsrc = $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
  let jcsrc = $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
/*
  jcsrc.find("div.wmd-preview > p").each((i,e) => {
    console.log("1 wmd-preview = "+e.outerHTML);
  });
*/

  let pl = 200;
  let pt = 200;

  jcsrc.offset({top:pt, left:pl});
  
  jcsrc.find('.edit_panel.compound').hide();

  jcsrc.find("div.wmd-button-bar > .wmd-button-row").each((i,e) => {
    e.remove();
  });

  jcsrc.find("div.wmd-preview > p").each((i,e) => {
    e.remove();
  });

  jcsrc.find("div.palette.score").remove();
  
  jcsrc.removeAttr("id");
  
  console.log("selector="+selector);
  
  let sts = Palette.split_selector(selector);
  if (sts.id.length>0) {
    if (sts.id.length>1) {
      alert("ERROR: More than one id has been specified.");
      return;
    } else if (!(Palette.check_for_id((sts.id)[0]))) {
      alert("ERROR: id " + (sts.id)[0] +" is already in use.");
      return;
    } else {
      jcsrc.attr("id",(sts.id)[0]);
    }
  }
  
  sts.class.forEach((sid,i) => {
    jcsrc.addClass(sid);
  });
    
  Palette.update_selectors(jcsrc);
  
  let suffixes = Palette.update_suffix(jcsrc);

  jcsrc.appendTo($('#test'));
  
  suffixes.forEach(s => {
    Palette_Markdown.starteditor(s);
    Palette_Markdown.delaytouch(s);
  });


}



Palette_Markdown.wait = async function(msecond) {
  return new Promise(resolve => setTimeout(resolve, msecond));
}


Palette_Markdown.touch = function(suffix) {

  let i = Number(suffix.replace(/_suffix_/,""));
  
  Palette_Markdown.mjpd[i].Editing.UpdateMJ();

}

Palette_Markdown.delaytouch = async function(suffix) {

  let i = Number(suffix.replace(/_suffix_/,""));
  await Palette_Markdown.wait(1000);
  Palette_Markdown.touch(suffix);
  
}


Palette_Compound.hide_edit = function() {

  let cpds = $('.palette.top.compound');
  
  cpds.children('div.palette.top').each(function(i,e) {
  
    $(e).children(':not(.target,.visible)').hide();
  
  });

}


Palette_Compound.pickup_name = function(str) {

//  console.log("pickup_name str="+str);
  let i;
  let words = str.split(/\s+/);
//  let twords = new Set(["button","img","text","text2","textarea","markdown","radio","pulldown","fraction","cinderella","compound"]);
  let twords = Palette.known_element_class;
  let cl = [];
  
  for (i=0; i<words.length; i++) {
    if (twords.has(words[i])) {
      cl.push(words[i]);
    }
  }
  
  if (cl.length>1) {
    alert("ERROR: Palette_Compound.pickup_name str="+str);
    return("");
  } else if (cl.length==1) {
    return(cl[0]);
  } else {
    return("");
  }


}


Palette_Compound.pickup_nonname = function(str) {

//  console.log("pickup_nonname str="+str);
  let i;
  let words = str.split(/\s+/);
//  let twords = new Set(["palette", "body", "top", "button","img","text","text2","textarea","markdown","radio","pulldown","fraction","cinderella","compound"]);
  let twords = Palette.known_class;
  let cl = [];

/*
  for (i=0; i<words.length; i++) {
    if (!twords.has(words[i])) {
      return(words[i]);
    }
  }
*/

  for (i=0; i<words.length; i++) {
    if (!twords.has(words[i])) {
      cl.push(words[i]);
    }
  }

  if (cl.length>1) {
    alert("ERROR: Palette_Compound.pickup_noname str="+str);
    return("");
  } else if (cl.length==1) {
    return(cl[0]);
  } else {
    return("");
  }


}

Palette_Compound.pickup_element = function(elm) {

  let w,nw,tindex={}, rtn=[];
  let tset = new Set();
  let tagsrc = "";
  let top = $(elm.parentElement);
  let jt, chek, clist;
  
  top.children('div.palette.top').each(function(i,e) {
    jt = $(this);
    clist = jt.attr("class");
    w = Palette_Compound.pickup_name(clist);
    nw = Palette_Compound.pickup_nonname(clist);
    console.log("w="+w+", nw="+nw);
    if (w != "") {
      if (tset.has(w)) {
        tindex[w]=tindex[w]+1;
      } else {
        tindex[w]=1;
        tset.add(w);
      }
      rtn.push([w,tindex[w]]);
      name = w + '_' + tindex[w];
      if (jt.children('input.move').css('display')=="none") {
        chek = "";
      } else {
        chek = "checked";
      }
      name = name + "<br>c："+ nw;
      tagsrc = tagsrc + '<input type="checkbox" value="' + name +  '" onchange = "Palette_Compound.change_edit(this,\''+w+'\','+tindex[w]+')" '+chek+'>' + name + '<br>\n';
      console.log("tagsrc="+tagsrc);
    }
  });
  
//  $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement).find(".edit_panel .compoundtag").html("test2");
  top.find(".edit_panel .compoundtag").html(tagsrc);
//  console.log(top.find('.edit_panel .compoundtag').html());
  
}

Palette_Compound.change_edit = function(ts,r,idx) {

  console.log("change_edit r="+r+", idx="+idx);

  let ck = ts.checked;
//  let top = ts.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
  let top = ts.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
  let elm, jelm, oldorder, tindex;
  
//  let elms = top.querySelectorAll('div.palette.top.button');
  let elms = top.querySelectorAll('div.palette.top.'+r);
  let morder = elms.length;
  elms.forEach((elm,i) => {
    jelm = $(elm);
    ord = Number(jelm.css("z-index"));
    if (ord == morder) {
      tindex = i;
    }
    console.log("i="+i+", ord="+ord+", tindex="+tindex);
    if (i==idx-1) {
      if (ck) {
        jelm.children(':not(.texta)').show();
        oldorder = ord;
        jelm.css("z-index",morder);
      } else {
        jelm.children(':not(.target,.visible)').hide();
      }
    }
  });
  if (ck) {
    $(elms[tindex]).css("z-index",oldorder);
  }

}

Palette_Compound.include_element = function(elm) {

//  console.log("elm="+elm.parentElement.parentElement.querySelector('.elm').value);
//  console.log("elm="+elm.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
//  console.log("elm="+elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.outerHTML);
  

//  let cpd = $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement);
//  let elmsrc = elm.parentElement.parentElement.querySelector('.elm').value;
  let cpd = $(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement);
  console.log("include -> "+ elm.parentElement.parentElement.parentElement.outerHTML);
  let elmsrc = elm.parentElement.parentElement.querySelector('.elm').value;
  let elmdiv = $(elmsrc);
  let epos = elmdiv.offset();
  let cpos = cpd.offset();
/*
  let tpos = $("#top_display").offset();
  elmdiv.offset({top: epos.top-cpos.top+tpos.top, left: epos.left-cpos.left+tpos.left});
*/
  elmdiv.offset({top: epos.top-cpos.top, left: epos.left-cpos.left});
  elmdiv.appendTo(cpd);
  
//  Palette_Compound.pickup_element(elm.parentElement.parentElement.parentElement.parentElement.parentElement);
  Palette_Compound.pickup_element(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement);

}

Palette_Compound.exclude_element = function(elm) {

//  let tmp = elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
  let tmp = elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
  console.log("tmp="+tmp.outerHTML);
  let cpd0 = $(tmp);
  let cpd = $(tmp.parentElement);
//  let elmsrc = elm.parentElement.parentElement.querySelector('.elm').value;
  console.log("exclude -> "+ elm.parentElement.parentElement.parentElement.outerHTML);
  let elmsrc = elm.parentElement.parentElement.querySelector('.elm').value;
  console.log("elemsrc="+elmsrc);
  let elmdiv = $(elmsrc);
  let epos = elmdiv.offset();
  let cpos = cpd0.offset();
/*
  let tpos = $("#top_display").offset();
  elmdiv.offset({top: epos.top+cpos.top-tpos.top, left: epos.left+cpos.left-tpos.left});
*/
  elmdiv.offset({top: epos.top+cpos.top, left: epos.left+cpos.left});
  epos = elmdiv.offset();
//  console.log("epos2="+JSON.stringify(epos));
  elmdiv.appendTo(cpd);

//  Palette_Compound.pickup_element(elm.parentElement.parentElement.parentElement.parentElement.parentElement);
  Palette_Compound.pickup_element(elm.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement);
}


Palette_Compound.delete_compound_menu = function(menu) {

  


}


Palette_Compound.move_mousedown = function(e) {

/*
  Palette_Body.pt = e.target.parentNode;

  Palette_Body.mouse_down_in = true;
  Palette_Body.mouse_rel_x = e.offsetX;
  Palette_Body.mouse_rel_y = e.offsetY;
*/
  
  Palette_Body.pt = e.target.parentNode;
  
  Palette_Body.ppt = Palette_Body.pt.parentNode;
  
  Palette_Body.mouse_down_in = true;

  if (Palette_Body.ppt.classList.contains('compound')) {
    Palette_Body.mouse_rel_x = e.offsetX + Palette.px2num(Palette_Body.ppt.style.left);
    Palette_Body.mouse_rel_y = e.offsetY - Palette_Compound.move_height + Palette.px2num(Palette_Body.ppt.style.top);
  } else {
    Palette_Body.mouse_rel_x = e.offsetX;
    Palette_Body.mouse_rel_y = e.offsetY - Palette_Compound.move_height;
  }
  
  
}


class Palette_Cindy extends Palette_Body {

  static classname = 'cindy';

/*
  static height = 380;
  static width = 560;
  static content_height = 30;
  static content_width = 30;
  static content_left = Palette_Body.edit_width + 10;
  static content_top = Palette_Markdown.height;
  static content;
  static wmd_input;
*/

  static cinderella_obj = [];
  static cinderella_code = [];
  static cinderella_json = [];
  static cinderella_csscript = [];
  static cinderella_init = [];
  
  constructor(divname,selector,x,y,width,height,index) {

/*
  	let classname = Palette_Cindy.classname;
  	let index = Palette.look_for_index_num(classname);
*/

  	let srccindy = `
    <div id="CSCanvas_`+index+`" class="CindyJS-widget palette body target cindy" style="position: relative; width: `+width+`px; height: `+height+`px;">
      <canvas width="`+width+`" style="position: absolute; border: none; top: 0px; left: 0px; padding: 0px; margin: 0px; height: 100%; width: 100%; background-color: rgb(168, 176, 192);" height="`+height+`"></canvas>
    </div>
`;
	let cindyjq = $(srccindy);

  	let element = super(divname,selector,x,y,width,height,cindyjq,Palette_Cindy.classname);
  	element.attr("index",index);
  	
  	return element;
	
  }

}


Palette_Cindy.size_mousemove = function(e) {

  if (Palette_Body.mouse_down_in) {

    let buttom = (e.clientY - Palette_Body.mouse_rel_y + document.body.scrollTop - Palette_Body.pt_top);
    let right =  (e.clientX - Palette_Body.mouse_rel_x + document.body.scrollLeft - Palette_Body.pt_left);

    e.target.style.top = (buttom) + 'px';
//    e.target.style.left = (right - Palette_Body.size_width) + 'px';
    e.target.style.left = Math.max((right - Palette_Body.size_width),Palette_Body.edit_width) + 'px';
    
    let target = e.target.parentNode;

/*
    console.log("cindy buttom="+buttom+", right="+right);
    console.log("targe="+target.outerHTML);
*/

    Palette_Body.target.style.width = right + 'px';
    Palette_Body.target.style.height = buttom + 'px';

//    Palette_Body.eraser.style.left = (right-Palette_Body.eraser_width) + 'px';
    Palette_Body.eraser.style.left = Math.max((right-Palette_Body.eraser_width), Palette_Body.move_width) + 'px';
    Palette_Body.edit.style.top = buttom + 'px';
    Palette_Body.texta.style.left = (right) + 'px';
    
 }
 
}


Palette_Cindy.eraser_mousedown = function(e) {

  let idx = e.target.parentNode.getAttribute("index");
//  console.log("Palette_Cindy.eraser_mousedown idx="+idx);
  let selector = "script[type='text/x-cindyscript'][id^='cs"+idx+"']";
//  console.log("selector = "+selector);
  $(selector).remove();
  e.target.parentElement.remove();


}




// $(document).on("mousedown",".palette.move:not(.compound,.comp_edit)", Palette.move_mousedown);
$(document).on("pointerdown",".palette.move:not(.compound,.comp_edit)", Palette.move_mousedown);
// $(document).on("mousedown",".palette.move.compound", Palette_Compound.move_mousedown);
$(document).on("pointerdown",".palette.move.compound", Palette_Compound.move_mousedown);

// $(document).on("mousedown",".palette.move.comp_edit", Palette_Compound_EditPanel.move_mousedown);
$(document).on("pointerdown",".palette.move.comp_edit", Palette_Compound_EditPanel.move_mousedown);

// $(document).on("mousemove",".palette.move", Palette.move_mousemove);
$(document).on("pointermove",".palette.move", Palette.move_mousemove);
// $(document).on("mouseup mouseout",".palette.move", Palette.move_mouseup_mouseout);
$(document).on("pointerup pointerout",".palette.move", Palette.move_mouseup_mouseout);

// $(document).on("mousedown",".palette.size:not(.markdown)", Palette_Body.size_mousedown);
$(document).on("pointerdown",".palette.size:not(.markdown)", Palette_Body.size_mousedown);
// $(document).on("mousedown",".palette.size.markdown", Palette_Markdown.size_mousedown);
$(document).on("pointerdown",".palette.size.markdown", Palette_Markdown.size_mousedown);

/*
$(document).on("mousemove",".palette.img.size", Palette_Img.size_mousemove);
$(document).on("mousemove",".palette.text.size", Palette_Text.size_mousemove);
$(document).on("mousemove",".palette.text2.size", Palette_Text2.size_mousemove);
$(document).on("mousemove",".palette.button.size", Palette_Button.size_mousemove);
$(document).on("mousemove",".palette.textarea.size", Palette_Button.size_mousemove);
$(document).on("mousemove",".palette.radio.size", Palette_Button.size_mousemove);
$(document).on("mousemove",".palette.markdown.size", Palette_Markdown.size_mousemove);
$(document).on("mousemove",".palette.cindy.size", Palette_Cindy.size_mousemove);
$(document).on("mousemove",".palette.fraction.size", Palette_Fraction.size_mousemove);
$(document).on("mousemove",".palette.echart.size", Palette_Button.size_mousemove);
*/

$(document).on("pointermove",".palette.img.size", Palette_Img.size_mousemove);
$(document).on("pointermove",".palette.text.size", Palette_Text.size_mousemove);
$(document).on("pointermove",".palette.text2.size", Palette_Text2.size_mousemove);
$(document).on("pointermove",".palette.button.size", Palette_Button.size_mousemove);
$(document).on("pointermove",".palette.textarea.size", Palette_Button.size_mousemove);
$(document).on("pointermove",".palette.radio.size", Palette_Button.size_mousemove);
$(document).on("pointermove",".palette.iframe.size", Palette_Button.size_mousemove);
$(document).on("pointermove",".palette.markdown.size", Palette_Markdown.size_mousemove);
$(document).on("pointermove",".palette.cindy.size", Palette_Cindy.size_mousemove);
$(document).on("pointermove",".palette.fraction.size", Palette_Fraction.size_mousemove);
$(document).on("pointermove",".palette.echart.size", Palette_Button.size_mousemove);

// $(document).on("mouseup mouseout",".palette.size",Palette_Body.size_mouseup_mouseout);
$(document).on("pointerup pointerout",".palette.size",Palette_Body.size_mouseup_mouseout);

// $(document).on("mouseup",".palette.size",Palette_Echart.size_mouseup);
$(document).on("pointerup",".palette.size",Palette_Echart.size_mouseup);

// $(document).on("mousedown",".palette.eraser:not(.cindy)", Palette.eraser_mousedown);
$(document).on("pointerdown",".palette.eraser:not(.cindy)", Palette.eraser_mousedown);
// $(document).on("mousedown",".palette.eraser.cindy", Palette_Cindy.eraser_mousedown);
$(document).on("pointerdown",".palette.eraser.cindy", Palette_Cindy.eraser_mousedown);

// $(document).on("mousedown",".palette.edit:not(.markdown)", Palette.edit_mousedown);
$(document).on("pointerdown",".palette.edit:not(.markdown)", Palette.edit_mousedown);
// $(document).on("mousedown",".palette.edit.markdown", Palette_Markdown.edit_mousedown);
$(document).on("pointerdown",".palette.edit.markdown", Palette_Markdown.edit_mousedown);

// $(document).on("mousedown",".palette.exe", Palette.exe_mousedown);
$(document).on("pointerdown",".palette.exe", Palette.exe_mousedown);

// $(document).on("mousedown",".palette.markdown.content", Palette_Markdown.content_mousedown);
$(document).on("pointerdown",".palette.markdown.content", Palette_Markdown.content_mousedown);

$(window).on("ready",Palette_Markdown.startalleditors);

// $(window).on("load",Palette.system_init);
// $(window).on("ready",Palette.system_init);

// $(window).on("load",Palette.mode_set("user"));

function check_answer(idlist,anslist) {
  let result=[];
  let ans, com;
  let alist = [];
  for (let i = 0; i < idlist.length; i++) {
    ans = toHalfWidth($('#' +idlist[i]+' > input[type="text"]').val());
    alist[i] = ans;
    com = 'simplify(('+ans+')-('+anslist[i]+'))';
    if (Number(Algebrite.run(com))==0) {
      result[i] = 1;
    } else {
      result[i] = 0;
    }
  }
  return([alist,result]);
}

function score(idlist,anslist) {
  let s="";
  let sc = 0;
  let [alist,res] = check_answer(idlist,anslist);
  for (let i = 0; i < res.length; i++) {
     if (res[i]==1) {
       s += "[" + (i+1) + "] : ◯   ";
       sc += 1;
     } else {
       s += "[" + (i+1) + "] : ✕  ";
     }
   }
   s = s + "\n Score : " + Math.round(100*sc/res.length);
   alert(s);
}

function HtmlString_To_Document(text){
  try{
    var dom_parser = new DOMParser();
    var document_obj = dom_parser.parseFromString(text , "text/html");
    if(document_obj.getElementsByTagName("parsererror").length == 0){
      return document_obj;
    }
  }catch(e){
  }

  try{
    var document_obj = document.implementation.createHTMLDocument("");
    document_obj.body.innerHTML = text;
    return document_obj;
  }catch(e){
  }

  return null;
}


/*
eval(getatr("onoff","tmp"));
if (tmp=="on") {
  eval(bgcolor(44,125,212,0.3));
  eval(setatr("onoff","off"));
} else {
  eval(bgcolor(44,125,212,1));
  eval(setatr("onoff","on"));
}



url = this.parentNode.querySelector('.palette_button_text_text').value;
window.open(url,"_blank");


});
*/

function bgcolor(r,g,b,a) {

  Palette_Body.target.style.background = "rgba("+r+","+g+","+b+","+a+")";

}

function selectorsetstring(selector,string) {

  $(selector).children(".target").attr("value",string);

}

function setstring(str) {

  Palette_Body.target.value = str;
  
}

function getstring() {

  return(Palette_Body.target.value);
  
}

function setatr(atr,val) {

//  return("this.parentNode.querySelector('.palette_button_body').setAttribute('"+atr+"','"+val+"');");
  Palette_Body.target.setAttribute(atr,val);
  
}

function getatr(atr) {

//  return(varname+"=this.parentNode.querySelector('.palette_button_body').getAttribute('"+atr+"');");
  return(Palette_Body.target.getAttribute(atr));
}

function getidx() {

  return(Number(Palette_Body.target.parentNode.getAttribute("index")));
  
}

function fillspreadthis() {

  fillspread(getidx());
  
}

function setstyle(prop,val) {

  $(Palette_Body.target).css(prop,val);
//  eval('Palette_Body.target.style.'+prop+' = "'+val+'"');
  
}

function setwidth(num) {

  setstyle('width',String(num)+'px');
  let eleft = Math.max(num-Palette_Body.eraser_width,Palette_Body.move_width);
  setbrstyle('.eraser','left',String(eleft)+'px');
  let sleft = Math.max(num-Palette_Body.size_width,Palette_Body.edit_width);
  setbrstyle('.size','left',String(sleft)+'px');
  setbrstyle('.texta','left',String(num)+'px');
  let type = geteltype();
  if ((type=="text2") || (type=="frac")) {
    setbrstyle('.exe','left',String(num)+'px');
  }
  
}

function thisindex() {

  return(Number(Palette_Body.target.parentNode.getAttribute('index')));
  
}

function moveselectorto(selector,left,top) {

  let lpt = String(left)+'px';
  let tpt = String(top)+'px';
  $(selector).css({left: lpt, top: tpt});

}

function moveto(left,top) {

  setptstyle('left',String(left)+'px');
  setptstyle('top',String(top)+'px');

}

function moverelativeto(selector,left,top) {

  let js = $(selector);

  let x = Number(js.css('left').replace('px',''));
  let y = Number(js.css('top').replace('px',''));
  
  moveto(left+x,top+y);

}

function geteltype() {

  return(Palette_Compound.pickup_name(Palette_Body.target.parentNode.getAttribute('class')));

}

function setbrstyle(selector,prop,val) {

  $(Palette_Body.target.parentNode).find(selector).css(prop,val);

}

function setptstyle(prop,val) {

  $(Palette_Body.target.parentNode).css(prop,val);

}

function getstyle(prop) {

//  let getStyle = getComputedStyle(Palette_Body.target);
//  return(eval('getStyle.'+prop));
  return($(Palette_Body.target).css(prop));
  
}

function gettext() {

  return(Palette_Body.target.value);

}

function link(url) {

  window.open(url,'_blank');
  
}

function startcindy() {

CindyJS({
  scripts: "cs*",
  defaultAppearance: {
    dimDependent: 0.7,
    fontFamily: "sans-serif",
    lineSize: 1,
    pointSize: 5.0,
    textsize: 12.0
  },
  angleUnit: "°",
  geometry: [
    {name: "A", type: "Free", pos: [-0.8, -4.0, 4.0], color: [1.0, 0.0, 0.0], labeled: true},
    {name: "B", type: "Free", pos: [4.0, 3.353293413173652, 0.5988023952095808], color: [1.0, 0.0, 0.0], labeled: true},
    {name: "a", type: "Segment", color: [0.0, 0.0, 1.0], args: ["A", "B"], labeled: true},
    {name: "C", type: "Free", pos: [4.0, -0.2641509433962264, 0.4716981132075471], color: [1.0, 0.0, 0.0], labeled: true},
    {name: "b", type: "Segment", color: [0.0, 0.0, 1.0], args: ["B", "C"], labeled: true},
    {name: "c", type: "Segment", color: [0.0, 0.0, 1.0], args: ["C", "A"], labeled: true}
  ],
  ports: [{
    id: "CSCanvas_0",
    width: 680,
    height: 337,
    transform: [{visibleRect: [-9.06, 9.34, 18.14, -4.14]}],
    grid: 1.0,
    background: "rgb(168,176,192)"
  }],
  csconsole: false,
  cinderella: {build: 2071, version: [3, 0, 2071]}
});


}

class Score {

  static scorefunc = {
    "a" : (e,cans,th) => th.algebraic_check1(e,cans),
    "p" : (e,cans,th) => th.pulldown_check1(e,cans),
    "str" : (e,cans,th) => th.string_check1(e,cans),
    "set" : (e,cans,th) => th.set_check1(e,cans),
    "os" : (e,cans,th) => th.ordered_set_check1(e,cans),
    "ss" : (e,cans,th) => th.sub_set_check1(e,cans),
    "frac" : (e,cans,th) => th.fraction_check1(e,cans),
    "cp" : (e,cans,th) => th.compound_check1(e,cans),
    "cp2" : (e,cans,th) => th.compound2_check1(e,cans)
  };
  
  static eqfunc = {
    "scalar" : (a,b,th) => a==b,
    "array" : (a,b,th) => th.orderedSameElements(a,b,(c,d)=>c==d),
    "noarray" : (a,b,th) => th.arraysHaveSameElements(a,b,(c,d)=>c==d),
    "noarray_array" : (a,b,th) => th.arraysHaveSameElements(a,b,(c,d) => th.orderedSameElements(c,d,(e,f)=>e==f))
  }
  
  constructor() {
  
    this.idlist = [];
    this.cans = {};
    this.type = {};
    this.csvformat = "";
    this.result = {};
    this.ans = {};
    this.idname = "";
    this.filename = "";
    this.remarkidlist = [];
    this.remarktype = {};
    this.userhtml = "";
    
  }

  add_problem(idname, cans, type) {
  
    console.log("add_problem idname="+idname+", cans="+cans+", type="+type);

    if (this.idlist.indexOf(idname)>=0) {
      alert("ERROR: add_problem  =>  idname "+idname+" is already registered!!");
      return(0);
    } else if (document.querySelector('#'+idname) === null) {
      alert("ERROR: add_problem =>  idname "+idname+" is not defined!!");
      return(0);
    } else {
      this.idlist.push(idname);
      this.cans[idname] = cans;
//      console.log("idname="+idname);
      this.type[idname] = type;
    
    }
    
  }
  
  gettime() {

   let now = new Date();
   let rtn = String(now.getFullYear()) + "年";
   rtn = rtn + String(now.getMonth()+1) + "月";
   rtn = rtn + String(now.getDate()) + "日";
   rtn = rtn + String(now.getHours()) + "時";
   rtn = rtn + String(now.getMinutes()) + "分";
   rtn = rtn + String(now.getSeconds()) + "秒";
 
   return(rtn);
 

  }

  
  set_csvformat(format) {
  
    this.csvformat = format;
  
  }
  
  
  score() {
    
    let sc=0, sccount=0;
    let resultchar;
    let s;
    
//    console.log("score()");
    
    this.mark();
    
    this.delallscore();
    
    this.idlist.forEach(e => {
      if (this.result[e] == 1) {
        resultchar = '●';
        sc = sc+1;
      } else {
        resultchar = '✖';
      }
      this.addscore(e,resultchar);
      sccount = sccount + 1;
    });
    if (sccount>0) {
      s = String(sccount) + "問中" + String(sc) + "問正解： 得点 " + Math.round(100*sc/sccount);
    } else {
      s = "答案を提出しました";
    }
    alert(s);
  
  }
  
  
  mark() {
  
    let cans, type;
    let a,r,resultchar;
    
    let resultlist=[], anslist=[],sc=0;
    
//    console.log("mark()");
    
    this.idlist.forEach(e => {
      cans = this.cans[e];
      type = this.type[e];
//      console.log("cans="+cans+", type="+type);
      if (type in Score.scorefunc) {
        [a,r] = Score.scorefunc[type]('#'+e,cans,this);
//        console.log("a="+a+", r="+r);
//          let estr = Score.scorefunc[type]+"(e,cans)";
//          console.log("estr="+estr);
//          [a,r] = eval(estr);
      } else {
        alert("ERROR: score()  type "+type+" is not defined!!");
        return(0);
      }
/*
      if (type == "a") {
        [a,r]=this.algebraic_check1(e,cans);
      } else if (type == "p") {
        [a,r]=this.pulldown_check1(e,cans);
      } else if (type == "str") {
        [a,r]=this.string_check1(e,cans);
      } else if (type == "set") {
        [a,r]=this.set_check1(e,cans);
      } else if (type == "os") {
        [a,r]=this.ordered_set_check1(e,cans);
      } else if (type == "ss") {
        [a,r]=this.sub_set_check1(e,cans);
      } else if (type == "frac") {
        [a,r]=this.fraction_check1(e,cans);
      } else if (type == "com_eq1") {
        [a,r]=this.com_eq1_check1(e,cans);
      } else if (type == "com_ineq1") {
        [a,r]=this.com_ineq1_check1(e,cans);
      } else if (type == "com_ineq2") {
        [a,r]=this.com_ineq2_check1(e,cans);
      } else {
        alert("ERROR: score()  type "+type+" is not defined!!");
        return(0);
      }
*/
      if (r==1) {
        resultchar = '●';
        sc = sc+1;
      } else {
        resultchar = '✖';
      }
      this.result[e] = r;
      this.ans[e] = a;
//      console.log("this.ans="+JSON.stringify(this.ans));
    });
    
    this.remarkidlist.forEach(e => {
      type = this.remarktype[e];
      if (type == "p") {
        a = this.get_pulldown_value('#'+e);
      } else if (type == "str") {
        a = this.get_text_value('#'+e);
      } else if (type == "ta") {
        console.log("mark()  #e="+"#"+e);
        a = this.get_textarea_value('#'+e);
        console.log("mark()  a="+a);
      } else {
        alert("ERROR: mark remarktype = "+type);
        return(0);
      }
      this.ans[e] = '"' + a + '"';
    });
    

  
  }
  
  add_id(idname) {
  
    this.idname = idname;
  
  }
  
  add_remark(idname,type) {
  
    this.remarkidlist.push(idname);
    this.remarktype[idname] = type;
    
  }

  uans2clist(uans) {
  
    return(JSON.stringify(uans).match(/"\w+"/g).map(a => a.replaceAll('"','')));
  
  }
  makecsv() {
  
    let i;
  
    let rtnformat = "((ID)),((DATE)),";
  
    if (this.idname == "") {
      alert("ERROR: makecsv id が定義されません!!");
      return(0);
    }
    
    let idvalue = this.get_text_value('#'+this.idname);
    if (idvalue.trim() == "") {
      alert("ERROR: makecsv id を入力してください!!");
      return(0);
    }

    let format = this.csvformat;
    
    this.mark();
    
    let cansset,cname,cans,type,cnamelist;

    if (format.length==0) {
    
      format = "";
      let format2 = "";
//      console.log("JSON.stringify(this.idlist)="+JSON.stringify(this.idlist));
      let sep = "";

      this.idlist.forEach(m => {
//        m = this.idlist[i];
        format = format + sep + "<<" + m + ">>";
        if (this.type[m]=="frac") {
          rtnformat = rtnformat +  sep + "<<"+m+">>_bunshi" + ",<<"+m+">>_bunbo";
        } else if (this.type[m]=="cp") {
           cansset = this.cans[m];
           cansset.forEach(r => {
             [cname,cans,type] = r;
             rtnformat = rtnformat +  sep + "<<"+m+">>_"+cname;
             sep = ",";
           });
        } else if (this.type[m]=="cp2") {
           cnamelist = this.uans2clist((this.cans[m])[0]);
           cnamelist.forEach(r => {
             rtnformat = rtnformat +  sep + "<<"+m+">>_"+r;
             sep = ",";
           });
        } else {
          rtnformat = rtnformat +  sep + "<<"+m+">>";
        }
        format2 = format2 + ",[[" + m + "]]";
        sep = ",";
      });
      
      format = format + format2;
      rtnformat = rtnformat + format2;
      
      format = format + ",((SUM)),((PNUM))";
      rtnformat = rtnformat + ",((SUM)),((PNUM))";
      
      this.remarkidlist.forEach(m => {
        format = format + ",<<" + m + ">>";
        if (this.type[m]=="frac") {
          rtnformat = rtnformat +  ",<<" + m + ">>_bunshi" + ",<<" + m + ">>_bunbo";
        } else if (this.type[m]=="cp") {
           cansset = this.cans[m];
           cansset.forEach(r => {
             [cname,cans,type] = r;
             rtnformat = rtnformat +  sep + "<<"+m+">>_"+type;
           });
        } else {
          rtnformat = rtnformat +  ",<<" + m + ">>";
        }
      });
      
      format = format + "\n";
      rtnformat = rtnformat + "\n";
    }
    
//    console.log("makecsv()  format="+format);
      
    let rtn = idvalue + "," + this.gettime() + "," + JSON.parse(JSON.stringify(format)); // make copy  
    
    let idname, ans, r;
    
    let mh = format.match(/<<.+?>>/g);
    if (mh != null) {
      mh.forEach(m => {
        idname = m.replace(/^<</,"").replace(/>>$/,"");
        ans = this.ans[idname];
        rtn = rtn.replaceAll(m,ans);
      });
    }
    let sumr=0;
    let suma=0;
    mh = format.match(/\[\[.+?\]\]/g);
    if (mh != null) {
      mh.forEach(m => {
        idname = m.replace(/^\[\[/,"").replace(/\]\]$/,"");
        r = this.result[idname];
        rtn = rtn.replaceAll(m,r);
        sumr = sumr + r;
        suma = suma + 1;
      });
    }
    
//    rtn = rtn + "," + suma + "," + sumr + "\n";

    rtn = rtn.replace(/\(\(SUM\)\)/,String(sumr));
    rtn = rtn.replace(/\(\(PNUM\)\)/,String(suma));
    
//    rtn = rtn + "\n";
    
    return([rtnformat,rtn]);

  }
  
  set_filename(fname) {
  
    this.filename = fname;
  
  }
  
  submit_answer() {
  
    let con = confirm("答案を提出し、課題を終了しますが、それで良いですか？");
    if (!(con)) {
      return(0);
    }
    
    let csvs = this.makecsv();
    console.log("sumbit_answer format="+csvs[0]);
//    let csv = csvs[1];
    if (csvs === 0) {
      return(0);
    }
    
    let uname = this.get_text_value('#'+this.idname);
    
//    console.log("csv="+csv);
//    console.log("uname="+uname);
    
    if (this.csv_check(uname)) {
      alert(uname+"さんの課題は既に提出されています");
      return(0);
    }
    
    this.submit_csv(csv);
    alert(uname + "さんの課題を提出しました");

  }
  
  submit_answer_no_check() {
  
    let con = confirm("答案を提出し、課題を終了しますが、それで良いですか？");
    if (!(con)) {
      return(0);
    }
    
    let csvs = this.makecsv();
    console.log("sumbit_answer format="+csvs[0]);
//    let csv = csvs[1];
    if (csv1 === 0) {
      return(0);
    }
    
    let uname = this.get_text_value('#'+this.idname);
    
    this.submit_csv(csv);
    alert(uname + "さんの課題を提出しました");

  }
  
  submit_and_score_answer() {
  
    let con = confirm("答案を提出し、課題を採点しますが、それで良いですか？");
    if (!(con)) {
      return(0);
    }
    
    let fe = this.file_check(this.filename);

    let csvs = this.makecsv();
    console.log("sumbit_answer format="+csvs[0]);
//    let csv = csvs[1];
    if (csvs === 0) {
      return(0);
    }
    
    let csv;
    
    if (fe == "TRUE") {
      csv = csvs[1];
    } else {
      csv = csvs[0]+csvs[1];
    }

    this.submit_csv(csv);
    this.score()
    
  }
  
  submit_score_save() {
  
    let con = confirm("答案を提出し、課題を採点しますが、それで良いですか？");
    if (!(con)) {
      return(0);
    }
    
    let fe = this.file_check(this.filename);

    let csvs = this.makecsv();
    console.log("sumbit_answer format="+csvs[0]);
    if (csvs === 0) {
      return(0);
    }
    
    let csv;

    let sn = 1+this.countSubmitNumber();
    
    if (fe == "TRUE") {
      csv = csvs[1];
      sn = 1+this.countSubmitNumber();
      
    } else {
      csv = csvs[0]+csvs[1];
      sn = 1;
    }

    this.submit_csv(csv);
    this.score()
    let uname = this.get_text_value('#'+this.idname);
    let filename = this.userhtml.replaceAll("[[id]]",uname).replaceAll("[[sn]]",String(sn));
//    let filename = this.userhtml.replace("[[id]]",uname).replace("[[sn]]",String(sn));
    $.post('https://ktky.sakura.ne.jp/file/recieve_data_ajax_write_raw.php','filename='+filename+'&data='+encodeURIComponent(Palette.htmlContents("user")));
//    this.save_userhtml(filename);
    
  }
  
  countSubmitNumber() {
  
    let url = "https://ktky.sakura.ne.jp/file/get_content.php";

    let content = this.get_content(url,this.filename);
    let strs = content.split(/\n/);
    let uname = this.get_text_value('#'+this.idname);
    let re = new RegExp("^"+uname);
    let num = 0;
    strs.forEach((e,i) => {
      if (re.test(e)) {
        num = num+1;
      }
    });
    return(num);
    
    
  
  
  }


  submit_csv(str) {

    let url = "https://ktky.sakura.ne.jp/file/recieve_data6.php";
    let com = {};
    com["data"] = str;
    com["filename"] = this.filename;
    console.log("url"+url);
    console.log("com="+com);
    Palette.exec_url(url,com);

  }
  
  
  file_check(filename) {
  
    let url = "https://ktky.sakura.ne.jp/file/file_check.php";
    let com = {};
    com["filename"] = filename;
    
    let result = this.get_content(url,filename);
    
    console.log("file_check result="+result);
    
    return(result);
    
  }


  get_content(url, filename) {

  //  let url = "https://ktky.sakura.ne.jp/file/get_content.php";
    let com = {};
    com["filename"] = filename;
  
    let hstring = Palette.exec_url(url,com);

    let csv = hstring.match(/<body>\r?\n([\s\S]*?)\r?\n<\/body>/);
  
    return csv[1];

  }
  
  put_content(filename,content) {
  
    let url = "https://ktky.sakura.ne.jp/file/recieve_data6.php";
    let com = {};
    com["data"] = content;
    com["filename"] = filename;
    console.log("filename"+filename);
    console.log("com="+com);
    Palette.exec_url(url,com);
  
  }

  

  csv_check(str) {

    let url = "https://ktky.sakura.ne.jp/file/get_content.php";
    let filename = this.filename;
//    let str = this.idname;
    let csv = this.get_content(url,filename);
    
//    console.log("csv="+csv);
    
    let tstr = String(str.trim());
    let tc;
    let i,li;

    let lines = csv.split(/\r\n|\n/);
    for(i=0;i<lines.length;i++) {
      tc = lines[i].split(/,/)[0].trim();
      if (tc == tstr) {
        return(true);
      }
    };
    
    return(false);

  }
  
  
  
//  algebraic_check1(idname,cans) {
  algebraic_check1(selector,cans) {
  
    console.log("algebraic_check1 selector="+selector+", cans="+cans);
  
    let result;
//    let comstr = $('#' +idname+' > input[type="text"]').val();
//    console.log("selector="+selector + ' input[type="text"]');
    let comstr = $(selector + ' input[type="text"]').val();
//    console.log("comstr="+comstr);
    let ans = this.toHalfWidth(comstr);
    let com = 'simplify(('+ans+')-('+ this.numhankaku(cans) + '))';
    if (Number(Algebrite.run(com))==0) {
      result = 1;
    } else {
      result = 0;
    }
//    return([ans,result]);
    return(['"'+ans+'"',result]);
  }


  toHalfWidth(str) {
    // 全角英数字を半角に変換
    
//    console.log("toHalfWidth str="+str);
    
    str = str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });


    str = str.replaceAll("＋","+");
    str = str.replaceAll("－","-");
    str = str.replaceAll("−","-");
    str = str.replaceAll("ー","-");
    str = str.replaceAll("‐","-");
    str = str.replaceAll("―","-");
    str = str.replaceAll("−","-");
    str = str.replaceAll("ｰ","-");
    str = str.replaceAll("＊","*");
    str = str.replaceAll("／","/");
    
    return str;
  }
  
  
  numhankaku(num) {
  
//     console.log("numhankaku num="+num);

     return(this.toHalfWidth(String(num)));

  }
  
//  get_text_value(idname) {
  get_text_value(selector) {
  
//    return($('#' +idname+' > input[type="text"]').val());
    return($(selector + ' > input[type="text"]').val());
    
  }
  
  get_textarea_value(selector) {
  
//    return($('#' +idname+' > input[type="text"]').val());
    return($(selector + ' > .target').val());
    
  }
  
//  get_pulldown_value(idname) {
  get_pulldown_value(selector) {

//    return($("#"+idname+" select").val());
    return($(selector + " select").val());

  }
  
  get_user_name() {
  
    return(this.get_text_value('#'+this.idname));
  
  }

//  pulldown_check1(idname,cans) {
  pulldown_check1(selector,cans) {
  
    let result;
//    let ans = this.get_pulldown_value(idname);
    console.log("pulldown_check1 selector="+selector+", cans="+cans);
    let ans = this.get_pulldown_value(selector);
    console.log("pulldown_check1 selector="+selector+", cans="+cans);
    if (Number(ans)==Number(this.numhankaku(cans))) {
      result = 1;
    } else {
      result = 0;
    }
//    return([ans,result]);
    return(['"'+ans+'"',result]);
  
  }
  

//  string_check1(idname,cans) {
  string_check1(selector,cans) {
  
    let result;
//    let ans = this.toHalfWidth($('#' +idname+' > input[type="text"]').val());
    let ans = this.toHalfWidth($(selector + ' > input[type="text"]').val());
    if (ans == this.numhankaku(cans)) {
      result = 1;
    } else {
      result = 0;
    }
//    return([ans,result]);
    return(['"'+ans+'"',result]);
    
  }
  
  maphankaku(nums) {
  
    let i,rtn = [];
    
    for (i=0;i<nums.length;i++) {
      rtn.push(this.numhankaku(nums[i]));
    }
    
    return rtn;
  
  
  }
  
  
//  general_set_check1(idname,numar,funcname) {
  general_set_check1(selector,numar,funcname) {
  
    let result;
//    let ans = this.space_split(this.toHalfWidth($('#' +idname+' > input[type="text"]').val()));
    let ans = this.space_split(this.toHalfWidth($(selector + ' > input[type="text"]').val()));
    if (ans.length==0) {
      return ([ans,0]);
    }
//    let cans = numar.map(this.numhankaku);
    let cans = this.maphankaku(numar);
//    console.log("cans="+cans);
//   console.log("funcname(ans,cans)="+funcname(ans,cans));
    if (funcname(ans,cans)) {
      result = 1;
    } else {
      result = 0;
    }
//    return([ans,result]);
    return(['"'+ans+'"',result]);
  }

//  set_check1(idname,numar) {
  set_check1(selector,numar) {
  
//    return(this.general_set_check1(idname,numar,this.arraysHaveSameElements));
//    return(this.general_set_check1(selector,numar,this.arraysHaveSameElements);
    return(this.general_set_check1(selector,numar,(a,b) => this.arraysHaveSameElements(a,b,(c,d)=>c==d)));
    
  }

//  ordered_set_check1(idname,numar) {
  ordered_set_check1(selector,numar) {
  
//    return(this.general_set_check1(idname,numar,this.orderedSameElements));
//    return(this.general_set_check1(selector,numar,this.orderedSameElements));
    return(this.general_set_check1(selector,numar,(a,b) => this.orderedSameElements(a,b,(c,d)=>c==d)));
  }

//  sub_set_check1(idname,numar) {
  sub_set_check1(selector,numar) {
  
//    return(this.general_set_check1(idname,numar,this.subsetElements));
    return(this.general_set_check1(selector,numar,this.subsetElements));
    
  }

  arraysHaveSameElements(arr1, arr2, eqq) {
    
    if (arr1.length !== arr2.length) {
        return false;
    }

    const sortedArr1 = arr1.sort();
    const sortedArr2 = arr2.sort();
    
    for (let i = 0; i < sortedArr1.length; i++) {
        if (!eqq(sortedArr1[i],sortedArr2[i])) {
            return false;
        }
    }
    return true;
    
  }


  orderedSameElements(arr1, arr2, eqq ) {
    
    if (arr1.length !== arr2.length) {
        return false;
    }
    
    for (let i = 0; i < arr1.length; i++) {
        if (!eqq(arr1[i],arr2[i])) {
            return false;
        }
    }
    return true;
  }
  
/*
  arraysHaveSameElements(arr1, arr2) {
    
    if (arr1.length !== arr2.length) {
        return false;
    }

    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();
    
    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] != sortedArr2[i]) {
            return false;
        }
    }
    return true;
    
  }


  orderedSameElements(arr1, arr2) {
    
    if (arr1.length !== arr2.length) {
        return false;
    }
    
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] != arr2[i]) {
            return false;
        }
    }
    return true;
  }
*/

  subsetElements(arr1, arr2) {

    if (arr1.length > arr2.length) {
        return false;
    }
    
    let set2 = new Set(arr2);
    
    for (let i = 0; i < arr1.length; i++) {
        if (!(set2.has(arr1[i]))) {
            return false;
        }
    }
    
    return true;

  }

  space_split(str) {

    return(str.split(/[、,\s　	]+/).filter(s => s.trim() !== ""));

  }
  
  addscore(idname,resultchar) {

    $('#'+idname).prepend('<div class="palette score" style="position: absolute; top: 0px; left: -20px; color: red;"><b>' + resultchar + '</b></div>');

  }

  delscore(idname) {

    $('#'+idname+' .palette.score').remove();

  }

  delallscore() {

    $('.palette.score').remove();
  
  }
  
//  fraction_check1(idname,bunsu) {
  fraction_check1(selector,bunsu) {
  
    let bunshi = bunsu[0];
    let bunbo = bunsu[1];
    let result;
//    let comstrbunshi = $('#' +idname+' .bunshi').val();
//    let comstrbunbo = $('#' +idname+' .bunbo').val();
    let comstrbunshi = $(selector + ' .bunshi').val();
    let comstrbunbo = $(selector + ' .bunbo').val();

/*
    console.log("comstrbunshi="+comstrbunshi);
    console.log("comstrbunbo"+comstrbunbo);
*/

    let ansbunshi = this.toHalfWidth(comstrbunshi);
    let ansbunbo = this.toHalfWidth(comstrbunbo);
    let com1 = 'simplify(('+ansbunshi+')-('+ this.numhankaku(bunshi) + '))';
    let com2 = 'simplify(('+ansbunbo+')-('+ this.numhankaku(bunbo) + '))';

/*
    console.log("com1="+com1);
    console.log("com2="+com2);
*/

    if ((Number(Algebrite.run(com1))==0)&&(Number(Algebrite.run(com2))==0)) {
      result = 1;
    } else {
      result = 0;
    }
//    return([[ansbunshi,ansbunbo],result]);
    return([['"'+ansbunshi+'"',ansbunbo],result]);
  }



  compound_check1(selector,canslist) {
    
    let cname,type,cans;
    let result=1;
//    let anslist={};
    let anslist=[];
    let a,r;

    canslist.forEach((e) => {
      [cname,cans,type] = e;
      
      if (type in Score.scorefunc) {
        [a,r] = Score.scorefunc[type](selector + ' .' + cname, cans, this);
      } else {
        alert("ERROR: compound_check1()  type "+type+" is not defined!!");
        return(0);
      }
      result = result*r;
//      anslist[cname] = a;
      anslist.push(a);
    });
    
    return([anslist,result]);
  
  
  }


  compound2_check1(selector,canslist) {
    
    let cname,type,cans,ua,ua2,uas,cnames,cn,cn0;
//    let anslist={};
    let anslist=[];
    let a,r,ans;
    let perror = false;
    
    console.log("selector="+selector);

//    canslist.forEach((e) => {
      [ua,cans,type] = canslist;
      uas = JSON.stringify(ua);
      cnames = uas.match(/"\w+"/g);
      console.log("uas="+uas);
      cnames.forEach((cn) => {
        cn0 = cn.replaceAll('"','');
        ans = this.numhankaku($(selector + ' .' + cn0 + ' .target').val());
        uas = uas.replace(cn, ans);
        anslist.push('"'+String(ans)+'"');
        console.log("cn="+cn+",cn0="+cn0+", ans="+ans+", uas="+uas+", anslist="+anslist);
      });
      try {
        ua2 = JSON.parse(uas);
      } catch (error) {
        return([anslist,0]);
      }
      if (type in Score.eqfunc) {
        if (Score.eqfunc[type](ua2, cans, this)) {
          r = 1;
        } else {
          r = 0;
        }
      } else {
        alert("ERROR: compound2_check1()  type "+type+" is not defined!!");
        return(0);
      }
//      anslist[cname] = a;
//      anslist.push(a);
    
    return([anslist,r]);
  
  }
  
  set_userhtml(url) {
  
    this.userhtml = url;
  
  }
  
  save_userhtml(filename) {
  
    let html = Palette.htmlContents("user");
    this.put_content(filename,html);
    
  
  }


/*
  static arcompnonorder(arr01, arr02, equalq) {
    // Check if the arrays are the same length
    if (arr01.length !== arr02.length) {
        return false;
    }
    
    let arr1 = arr01.sort();
    let arr2 = arr02.sort();
    
    // Check if all elements are equal using the provided comparator function
    for (let i = 0; i < arr1.length; i++) {
        if (!equalq(arr1[i], arr2[i])) {
            return false;
        }
    }

    // If all checks pass, the arrays are equal
    return true;
  }
  
  static arcomporder(arr1, arr2, equalq) {
    // Check if the arrays are the same length
    if (arr1.length !== arr2.length) {
        return false;
    }
    
    // Check if all elements are equal using the provided comparator function
    for (let i = 0; i < arr1.length; i++) {
        if (!equalq(arr1[i], arr2[i])) {
            return false;
        }
    }

    // If all checks pass, the arrays are equal
    return true;
  }

  com_eq1_check1(idname,cans) {
  
    console.log("com_eq1_check1 idname="+idname+", cans="+cans);
  
    let ans = this.toHalfWidth($('#' +idname+' .expr .target').val());
    let com = 'simplify(('+ans+')-('+ this.numhankaku(cans) + '))';
    
    console.log("ans="+ans+", com="+com);
    
    let result;
    
    if (Number(Algebrite.run(com))==0) {
      result = 1;
    } else {
      result = 0;
    }
    return([ans,result]);
    
  }
  
  com_ineq1_check1(idname,cans) {
  
    let sans = Number($("#"+idname+" .sym select").val());
    let eans = this.numhankaku($("#"+idname+" .expr .target").val());
    
    let com = 'simplify(('+eans+')-('+ this.numhankaku(cans[1]) + '))';
    
    console.log("com_ineq1_check sans="+sans+", eans="+eans+", com="+com);
    
    let result;
    if (sans==Number(this.numhankaku(cans[0])) && Number(Algebrite.run(com))==0) {
      result = 1;
    } else {
      result = 0;
    }
    
    return([[sans,eans],result]);
    
  }


  com_ineq2_check1(idname,cans) {
  
    console.log("com_ineq2_check1 idname="+idname+", cans="+cans);
  
    let sans1 = Number($("#"+idname+" .sym1 select").val());
    let sans2 = Number($("#"+idname+" .sym2 select").val());
    let eans1 = this.numhankaku($("#"+idname+" .expr1 .target").val());
    let eans2 = this.numhankaku($("#"+idname+" .expr2 .target").val());
    
    let ans = [eans1,sans1,sans2,eans2];
    
    let com1 = 'simplify(('+eans1+')-('+ this.numhankaku(cans[0]) + '))';
    let com2 = 'simplify(('+eans2+')-('+ this.numhankaku(cans[3]) + '))';
    
    console.log("com_ineq2_check sans1="+sans1+", eans1="+eans1+", com1="+com1);
    console.log("com_ineq2_check sans2="+sans2+", eans2="+eans2+", com1="+com2);
    
    let result;
    if (sans1==Number(this.numhankaku(cans[1])) && sans2==Number(this.numhankaku(cans[2])) &&
        Number(Algebrite.run(com1))==0 && Number(Algebrite.run(com2))==0 ) {
      result = 1;
    } else {
      result = 0;
    }
    
    return([ans,result]);
    
  }
  


*/



  
}



async function wait(msecond) {
    return new Promise(resolve => setTimeout(resolve, msecond));
}

/*
async function log() {
    console.log("3秒後にログを表示します。");
    Palette_Markdown.starteditor("_suffix_1");
    await wait(1000);
    console.log("3秒経過しました。");
    Palette_Markdown.starteditor("_suffix_2");
}
*/

async function settouch(suffix) {
    console.log("1秒後にログを表示します。");
    await wait(1000);
    console.log("1秒経過しました。");
    Palette_Markdown.touch(suffix);
}


function addscore(idname,resultchar) {

  $('#'+idname).prepend('<div class="palette score" style="position: absolute; top: 0px; left: -20px; color: red;"><b>' + resultchar + '</b></div>');

}

function delscore(idname) {

  $('#'+idname+' .palette.score').remove();

}

function delallscore() {

  $('.palette.score').remove();
  
}



function get_ketmath_input_raw() {

  return(document.getElementById('test_iframe').contentWindow.cdy.evalcs('Text2').value.text);

}

function get_ketmath_input() {

  return(get_ketmath_input_raw().split("=")[1]);

}

function cseval(cindyname,com) {

  let idx = Number($("#"+cindyname).attr("index"));
  return(Palette_Cindy.cinderella_obj[idx].evalcs(com).value);

}

/*
function csdraw(cindyname,com) {

  let idx = Number($("#"+cindyname).attr("index"));
  Palette_Cindy.cinderella_obj[idx].evokeCS("csdraw():=("+com+")");

}
*/

function csact(act,cindyname,com) {

  let idx = Number($("#"+cindyname).attr("index"));
  console.log("csact cindyname="+cindyname+", idx="+idx);
  $("#cs"+idx+act).html(com);
  console.log("csact act="+act+", html="+$("#cs"+idx+act).html());
  eval(Palette_Cindy.cinderella_code[idx]);
//  Palette_Cindy.cinderella_obj[idx].evokeCS("csdraw():=("+com+")");

}

function csact_append(act,cindyname,com) {

  let idx = Number($("#"+cindyname).attr("index"));
  let html = $("#cs"+idx+act).html();
  $("#cs"+idx+act).html(html+com);
  eval(Palette_Cindy.cinderella_code[idx]);
//  Palette_Cindy.cinderella_obj[idx].evokeCS("csdraw():=("+com+")");

}

function csdraw(cindyname,com) {

//  console.log("csdraw cindyname="+cindyname+", com="+com);

  csact("draw",cindyname,com);

}

function csdraw_append(cindyname,com) {

  csact_append("draw",cindyname,com);

}


function csdmove(cindyname,com) {

  csact("move",cindyname,com);

}

function csmove_append(cindyname,com) {

  csact_append("move",cindyname,com);

}



