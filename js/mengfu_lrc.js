
/**
 * lrc parser and player
 * @version 0.1.0
 */

var Lrc = (function(){
    Date.now = Date.now || (new Date).getTime;
    var timeExp = /\[(\d{2,})\:(\d{2})(?:\.(\d{2,3}))?\]/g
      , tagsRegMap = {
          title: 'ti'
        , artist: 'ar'
        , album: 'al'
        , offset: 'offset'
        , by: 'by'
      };

      this.getLrc = function () {
        // 异步获取歌词
        //let _this = this;
        //_this.canPlay = 0;
        axios.get(requestUrl).then(function (response) {
            let data = response.data;// 获取数据
            console.log(data);
            return Parser(data);
            //return data;
            //_this.requestText = data;
            // _this.flagTags = _this.getFlagTags(data);// 解析标志
            // _this.timeTags = _this.getTimeTags(data);// 解析歌词
            // // 判断是否成功解析,不为空.
            // _this.canPlay = (Object.keys(_this.timeTags).length == 0) ? 2 : 3;// 设置当前状态
        }).catch(function (error) {
            //_this.canPlay = 1;// 设置错误状态
            console.log(error);
        });
    }  
    
    /**
     * lrc parser
     * @param {string} lrc lrc 歌词字符串
     * @param {function} [handler] 
     * @constructor
     */
    var Parser = function(lrc, handler){
      lrc = Parser.trim(lrc);
      this.lrc = lrc;//lrc 歌词
      this.handler = handler || function(){}
      this.tags = {};//ID tags. 标题, 歌手, 专辑
      this.lines = [];//详细的歌词信息
      this.txts = [];
      this.isLrc = Parser.isLrc(lrc);
      
      this.curLine = 0;//
      this.state = 0;// 0: stop, 1: playing
          
      var res, line, time, lines = lrc.split(/\n/)
        , _last;
      
      for(var tag in tagsRegMap){
        res = lrc.match(new RegExp('\\[' + tagsRegMap[tag] + ':([^\\]]*)\\]', 'i'));
        this.tags[tag] = res && res[1] || '';
      }
      
      timeExp.lastIndex = 0;
      for(var i = 0, l = lines.length; i < l; i++){
        while(time = timeExp.exec(lines[i])){
          _last = timeExp.lastIndex;
          line = Parser.trim(lines[i].replace(timeExp, ''));
          timeExp.lastIndex = _last;
          this.lines.push({
              time: time[1] * 60 * 1000 + time[2] * 1000 + (time[3] || 0) * 10
            , originLineNum: i
            , txt: line
          });
          this.txts.push(line);
        }
      }
      
      this.lines.sort(function(a, b){
        return a.time - b.time;
      });
    };
    
    //按照时间点确定歌词行数
    function findCurLine(time){
      for(var i = 0, l = this.lines.length; i < l; i++){
        if(time <= this.lines[i].time){
          break;
        }
      }
      return i;
    }
    
    function focusLine(i){
      this.handler.call(this, this.lines[i].txt, {
          originLineNum: this.lines[i].originLineNum
        , lineNum: i
      })
    }
    
    //lrc stream control and output
    Parser.prototype = {
        //time: 播放起点, skipLast: 是否忽略即将播放歌词的前一条(可能是正在唱的)
        play: function(time, skipLast){
          var that = this;
          
          time = time || 0;
          that._startStamp = Date.now() - time;//相对开始时间戳
          that.state = 1;
          
          if(that.isLrc){
            that.curLine = findCurLine.call(that, time);
            
            if(!skipLast){
              that.curLine && focusLine.call(that, that.curLine - 1);
            }
            
            if(that.curLine < that.lines.length){
            
              clearTimeout(that._timer);
              that._timer = setTimeout(function loopy(){
                focusLine.call(that, that.curLine++);
                
                if(that.lines[that.curLine]){
                  that._timer = setTimeout(function(){
                    loopy();
                  }, that.lines[that.curLine].time - (Date.now() - that._startStamp));
                  //}, that.lines[that.curLine].time - that.lines[that.curLine--].time);//一些情况可能用得上
                }else{
                  //end
                }
              }, that.lines[that.curLine].time - time)
            }
          }
        }
      , pauseToggle: function(){
          var now = Date.now();
          if(this.state){
            this.stop();
            this._pauseStamp = now;
          }else{
            this.play((this._pauseStamp || now) - (this._startStamp || now), true);
            delete this._pauseStamp;
          }
        }
      , seek: function(offset){
          this._startStamp -= offset;
          this.state && this.play(Date.now() - this._startStamp);//播放时让修改立即生效
        }
      , stop: function(){
          this.state = 0;
          clearTimeout(this._timer);
        }
    };
      
    Parser.trim = function(lrc){
      return lrc.replace(/(^\s*|\s*$)/m, '')
    };
    Parser.isLrc = function(lrc){
      return timeExp.test(lrc);
    };
    return Parser;
  })();
  
  //node.js module
  if(typeof module !== 'undefined' && this.module !== module){
    module.exports.Lrc = Lrc;
  }