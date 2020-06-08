window.onload = () => {
  const inputElem = document.getElementById("codeInput")
  const renderOut = document.getElementById("renderOutput")
  const textOut = document.getElementById("codeOutput")
  const parseOut = document.getElementById("parseOutput")
  const updateTree = f => {
    try{
      var res = f()
      if(!res){throw new Error()}
      treeOut = res
      parseOut.value = JSON.stringify(treeOut,null,"  ")
      const reconstructedLatex = renderAsLatex(treeOut,document.getElementById("typesCheck").checked)
      console.log(reconstructedLatex)
      katex.render(reconstructedLatex,renderOut,{displayMode: true})
      const actions = document.getElementById("actionList")
      actions.innerHTML = ""
      for(let rule of sortedRules){
        var locs = []
        if(rule.match(treeOut)){
          locs.push([])
        }
        traverseSubExprs(treeOut,(o,p,c) => {
          if(rule.match(o[p])){
            locs.push(clone(c))
          }
        })
        //document.getElementById("ruleButton" + rule.name).disabled = locs.length == 0
        locs.forEach(loc =>{
          var button = document.createElement("button")
          button.className = "actionButton"
          button.addEventListener("click", e => {
            updateTree(() => {console.log(clone(rule),treeOut,loc); return matchApplyAtCrumb(rule,treeOut,loc)})
          })

          button.append(rule.name)

          var leftTex = document.createElement("div")
          button.appendChild(leftTex)
          katex.render(renderAsLatex(atCrumb(treeOut,loc),true),leftTex,{displayMode: false})

          button.append("becomes")

          var rightTex = document.createElement("div")
          button.appendChild(rightTex)
          katex.render(renderAsLatex(matchApply(rule,clone(atCrumb(treeOut,loc))),true),rightTex,{displayMode: false})
          button.append("loc: ",loc)

          actions.prepend(button)
        })
      }
    }catch(e){
      renderOut.style.backgroundColor = "#ff7777"
      renderOut.innerHTML = e + " at line " + e.lineNumber + " col " + e.columnNumber + "\nTrace:\n\n" + e.stack
      return
    }
    renderOut.style.backgroundColor = "#77ff77"
  }
  document.getElementById("typesCheck").addEventListener("click", e => updateTree(() => treeOut))
  inputElem.addEventListener("input",e => {
    updateTree(() => {
      const katexOut = katex.__parse(inputElem.value.replace(/\$/g,""))
      textOut.value = JSON.stringify(katexOut,null,"  ")
      return parsedToTree(katexOut)
    })
  })
  parseOut.addEventListener("change", e => {
    updateTree(() => JSON.parse(parseOut.value))
  })
  /*const buttonDiv = document.getElementById("ruleButtons")
  for(let k in allRules){
    const button = document.createElement("button")
    button.className = "ruleButton"
    button.id = "ruleButton" + allRules[k].name
    button.addEventListener("click", e => {
      updateTree(() => deepApply(allRules[k],treeOut))
    })
    button.innerHTML = allRules[k].name
    buttonDiv.appendChild(button)
  }*/
  if(inputElem.value == ""){
    inputElem.value = "\\sum_{i=0}^5 \\frac{\\partial}{\\partial x^i}f"
  }
  inputElem.dispatchEvent(new Event("input"))
}

// One shot render an expression
function renderExpr(expr){
  const renderOut = document.getElementById("renderOutput")
  const newRenderSpot = document.createElement("div")
  renderOut.appendChild(newRenderSpot)
  console.log(expr)
  console.log(renderAsLatex(expr))
  katex.render(renderAsLatex(expr),newRenderSpot,{displayMode: true})
}

function renderType(type){
  if(!type || !type.style){
    return "\\, ? \\, "
  }
  if(type.style == "function"){
    return renderType(type.domain || "?") + "\\to " + renderType(type.codomain || "?")
  }
  if(type.style == "set"){
    return (type.set || renderType("?"))
  }
}

// Render out our expression tree to latex
function renderAsLatex(tree, showTypes = false){
  var out = ""
  if(Array.isArray(tree)){
    tree.forEach(x => {
      if(Array.isArray(x)){
        out += renderAsLatex({paren: x},showTypes)
      }else{
        out += renderAsLatex(x,showTypes)
      }
    })
  }
  else if(tree.paren){
    out += "\\left(" + renderAsLatex(tree.paren,showTypes) + "\\right)"
  }
  else if(tree.ord){
    out += "{" + renderAsLatex(tree.ord,showTypes) + "}"
  }
  else if(tree.objectName){
    const renderer = objectRenderers.find(x => x.objectName == tree.objectName).render
    var thisBit = renderAsLatex(renderer(tree.data),showTypes)
    if(showTypes && tree.typing){
      out += "{\\left\\langle " + thisBit + " \\colon " + renderAsLatex(tree.typing,showTypes) + "\\right\\rangle} "
    }else{
      out += thisBit
    }
  }
  else if(tree.binop){
    out += renderAsLatex(tree.left,showTypes) + renderAsLatex(tree.binop,showTypes) + renderAsLatex(tree.right,showTypes)
  }
  else if(tree.operator){
    var thisBit = renderAsLatex(tree.operator,showTypes) + "[ " + renderAsLatex(tree.argument,showTypes) + " ] "
    if(showTypes && tree.typing){
      out += "{\\left\\langle " + thisBit + " \\colon " + renderAsLatex(tree.typing,showTypes) + "\\right\\rangle} "
    }else{
      out += thisBit
    }
  }
  else if(tree.numer){
    out += "\\frac" + renderAsLatex(tree.numer,showTypes) + renderAsLatex(tree.denom,showTypes)
  }
  else if(tree.base){
    var thisBit = ""
    thisBit += renderAsLatex(tree.base,showTypes)
    if(tree.sub){
      thisBit += "_" + renderAsLatex(tree.sub,showTypes)
    }
    if(tree.sup){
      thisBit += "^" + renderAsLatex(tree.sup,showTypes)
    }
    if(showTypes && tree.typing){
      out += "{\\left\\langle " + thisBit + " \\colon " + renderAsLatex(tree.typing,showTypes) + "\\right\\rangle} "
    }else{
      out += thisBit
    }
  }
  else if(tree.textContent){
    if(showTypes && tree.typing){
      out += "{\\left\\langle " + tree.textContent + " \\colon " + renderAsLatex(tree.typing,showTypes) + "\\right\\rangle} "
    }else{
      out += tree.textContent + " "
    }
  }
  if(tree.value){
    out = "\\textcolor{blue}{" + out + "}"
  }
  return out
}

function matchApplyAtCrumb(rule,x,crumb){
  console.log("crumb is ",crumb)
  if(crumb.length == 0){
    return matchApply(rule,x)
  }
  if(crumb.length == 1){
    x[crumb[0]] = matchApply(rule,x[crumb[0]])
  }else{
    matchApplyAtCrumb(rule,x[crumb[0]],crumb.slice(1))
  }
  return x
}

function atCrumb(x,crumb){
  if(crumb.length == 0){
    return x
  }
  return atCrumb(x[crumb[0]],crumb.slice(1))
}

function setCrumb(x,crumb,val){
  if(crumb.length == 1){
    x[crumb[0]] = val
    return
  }
  setCrumb(x[crumb[0]],crumb.slice(1),val)
}

// Convert from katex parse tree into an expression tree
// further simplifactions are required after this
function parsedToTree(katexOutput){
  var crumbs = []
  var out = []
  var curSubExpr = []
  crumbs.push(curSubExpr)
  const parseStep = x => {
    if(!x){return}
    if(!curSubExpr){
      curSubExpr = []
    }
    if(x.type == "atom"){
      if(x.family == "open"){
        var newCur = []
        curSubExpr.push({paren: newCur})
        crumbs.push(curSubExpr)
        curSubExpr = newCur
        return
      }
      if(x.family == "close"){
        curSubExpr = crumbs.pop()
        return
      }
    }
    if(x.type == "text"){
      var string = ""
      x.body.forEach(textPc => {string += textPc.text})
      curSubExpr.push({textContent: "\\text{" + string + "}"})
      return
    }
    if(x.type == "supsub"){
      var scriptedObj = {}
      curSubExpr.push(scriptedObj)

      crumbs.push(curSubExpr)
      curSubExpr = undefined
      parseStep(x.base)
      scriptedObj.base = curSubExpr

      curSubExpr = undefined
      parseStep(x.sub)
      if(curSubExpr)
        scriptedObj.sub = curSubExpr

      curSubExpr = undefined
      parseStep(x.sup)
      if(curSubExpr)
        scriptedObj.sup = curSubExpr

      curSubExpr = crumbs.pop()
      return
    }
    if(x.type == "ordgroup"){
      var ordGroupObj = {}
      curSubExpr.push(ordGroupObj)
      crumbs.push(curSubExpr)

      curSubExpr = undefined
      x.body.forEach(parseStep)
      ordGroupObj.ord = curSubExpr

      curSubExpr = crumbs.pop()
      return
    }
    if(x.type == "leftright"){
      var parensObj = {}
      curSubExpr.push(parensObj)
      crumbs.push(curSubExpr)

      curSubExpr = undefined
      x.body.forEach(parseStep)
      parensObj.paren = curSubExpr

      curSubExpr = crumbs.pop()
      return
    }
    if(x.type == "genfrac"){
      var fracObj = {}
      curSubExpr.push(fracObj)
      crumbs.push(curSubExpr)

      curSubExpr = undefined
      parseStep(x.numer)
      fracObj.numer = curSubExpr

      curSubExpr = undefined
      parseStep(x.denom)
      fracObj.denom = curSubExpr

      curSubExpr = crumbs.pop()
      return
    }
    if(x.type == "mathord" || x.type == "textord"){
      curSubExpr.push({textContent: x.text, origin: "parse", type: x.type})
    }
    if(x.type == "atom"){
      curSubExpr.push({textContent: x.text, origin: "parse", type: x.type, family: x.family})
    }
    if(x.type == "op"){
      curSubExpr.push({textContent: x.name, origin: "parse", type: x.type})
    }
  }
  katexOutput.forEach(parseStep)
  if(crumbs.length != 1){console.warn("Mismatched brackets!"); return undefined}
  return deepApply(validRules.singletonArrayReduce,curSubExpr)
}

// Contains all rules, even those that are only sometimes mathematically correct
allRules = {}
// Contains rules which are always valid to apply with impunity
validRules = {}

objectRenderers = [
  {objectName: "pullback", render: data => {
    return {base: data.base, sup: {textContent: "*"}}
  }, recog: t => {
    var data = {base: t.base}
    return data
  }},
  {objectName: "partial", render: data => {
    return {numer: {ord: {textContent: "\\partial"}}, denom: {ord: [{textContent: "\\partial"},data.variable]}}
  }, recog: t => {
    if(t.numer?.ord.textContent == "\\partial" && t.denom?.ord[0]?.textContent == "\\partial" && t.denom.ord.length > 1){
      return {variable: deepApply(validRules.singletonArrayReduce,t.denom.ord.slice(1))}
    }
  }}
]

objectRenderers.forEach(objRend => {
  allRules["recog:" + objRend.objectName] = {
    name: "Recognize " + objRend.objectName,
    match: t => {
      var data = objRend.recog(t)
      if(data && objectMatches(objRend.render(data),t)){
        return data
      }
    },
    apply: (t,o) => {return clone({objectName: objRend.objectName, data: o})}
  }
})

additiveTemplate = {
  priority: 20,
  name: "Additivity",
  reqs: {operator: {typing: {additive: true}}, argument: {binop: {textContent: "+"}}},
  replace: {left: {operator: {template: ["operator"]}, argument: {template: ["argument","left"]}}, binop: {template: ["argument","binop"]}, right: {operator: {template: ["operator"]}, argument: {template: ["argument","right"]}}}
}

function ruleFromTemplate(template){
  return {
    priority: template.priority,
    name: template.name,
    match: t => objectMatches(template.reqs,t),
    apply: (t,o) => {
      const trav = obj => {
        console.log(obj)
        for(let k in obj){
          if(obj[k].template){
            obj[k] = atCrumb(t,obj[k].template)
          }else{
            trav(obj[k])
          }
        }
      }
      var out = clone(template.replace)
      trav(out)
      return out
    }
  }
}

[{op: "\\div", func: (a,b) => a / b, name: "Division"}
,{op: "-", func: (a,b) => a - b, name: "Subtraction"}
,{op: "\\cdot", func: (a,b) => a * b, name: "Multiplication"}
,{op: "+", func: (a,b) => a + b, name: "Addtion"}].forEach(x => {
  allRules["evalReal" + x.name] = {
    priority: 100,
    name: "Eval Real " + x.name,
    match: t => {
      if(t.binop?.textContent == x.op && t.left.value && t.right.value && t.binop.typing && objectMatches(mkBinopType({textContent: "\\mathbb{R}"},{textContent: "\\mathbb{R}"},{textContent: "\\mathbb{R}"}),t.binop.typing)){
        return x.func(t.left.value.number, t.right.value.number)
      }
    },
    apply: (t,o) => {return {textContent: o.toFixed(3), origin: "Eval Real " + x.name, typing: {textContent: "\\mathbb{R}"}, value: {number: o}}}
  }
})

allRules.assumeJuxtIsCdotRule = {
  priority: -10,
  name: "Juxt to Cdot",
  match: t => {
    if(Array.isArray(t) && t.length > 1){
      return {left: t[0], right: t[1], rest: t.slice(2)}
    }
  },
  apply: (t,o) => {return matchApply(validRules.singletonArrayReduce,[{binop: {textContent: "\\cdot", origin: "Juxtaposition"}, left: o.left, right: o.right}].concat(o.rest))}
}

validRules.singletonArrayReduce = {
  priority: 100,
  name: "Singleton array reduce",
  match: t => {
    if(Array.isArray(t) && t.length == 1){
      return t[0]
    }
  },
  apply: (t,o) => o
}

validRules.additivity = ruleFromTemplate(additiveTemplate)

validRules.recognizeBinop = {
  priority: 100,
  name: "Recognize binop",
  match: t => {
    if(Array.isArray(t) && t.length == 3 && t[1].family == "bin"){
      return {left: t[0], binop: t[1], right: t[2]}
    }
  },
  apply: (t,o) => o
}

validRules.symbolicPartial = {
  priority: 100,
  name: "Symbolic Partial",
  match: t => {
    if(t.numer?.ord.textContent == "\\partial" && t.denom?.ord[0]?.textContent == "\\partial" && t.denom.ord.length > 1){
      return {variable: deepApply(validRules.singletonArrayReduce,t.denom.ord.slice(1))}
    }
  },
  apply: (t,o) => {return {objectName: "partial", data: {variable: o.variable}, type: "op"}}
}

allRules.productRule = {
  priority: 20,
  name: "Product rule",
  match: t => {
    if(t.operator?.objectName == "partial" && t.argument.binop?.textContent == "\\cdot"){
      return {deriv: t.operator,prod: t.argument.left, rest: t.argument.right}
    }
  },
  apply: (t,o) => {
    var out = 
      {binop: {textContent: "+", origin: "Product rule"}
      ,left: {binop: {textContent: "\\cdot", origin: "Product rule"}, left: {paren: {operator: o.deriv, argument: o.prod}},right: o.rest}
      ,right: {binop: {textContent: "\\cdot", origin: "Product rule"}, left: o.prod,right: {paren: {operator: o.deriv, argument: o.rest}}}
      }
    return clone(out)
  }
}

const bigOperators = [{symbol: "\\sum", binop: "+", empty: "0"},{symbol: "\\prod", binop: "\\cdot", empty: "1"}]

validRules.expandBigOperator = {
  priority: 20,
  name: "Expand big operator",
  match: t => {
    for(const op of bigOperators){
      if(t.operator?.base?.textContent == op.symbol){
        var equals = t.operator?.sub.ord?.binop?.textContent
        if(equals != "="){return}
        var idx = t.operator.sub.ord.left
        var start = numberLiteral(t.operator.sub.ord.right)
        var end = numberLiteral(t.operator.sup)
        if(end < start || !Number.isInteger(start) || !Number.isInteger(end) || !idx){ return }
        return {tree: t.argument,idx: idx, start: start, end: end, op: op}
      }
    }
  },
  apply: (t,o) => {
    if(o.start == o.end){
      return {textContent: o.op.empty, origin: "Explicated empty big operator"}
    }
    var out
    for(var i = o.start; i <= o.end; i++){
      thisTree = clone(o.tree)
      traverseSubExprs(thisTree,(ob,p,c) => {
        if(objectMatches(o.idx,ob[p])){
          ob[p] = {ord: {textContent: i.toString(), origin: "Big operator index"}}
        }
      })
      if(out){
        out = {left: out, binop: {textContent: o.op.binop, origin: "Big operator"}, right: {paren: thisTree}}
      }else{
        out = {paren: thisTree}
      }
    }
    return out
  }
}

allRules.outputType = {
  priority: -10,
  name: "Use operator output type",
  match: t => {
    if(t.typing?.textContent == "?" && t.operator?.typing?.binop?.textContent == "\\to" && t.operator.typing.right.textContent != "?"){
      return clone(t.operator.typing.right)
    }
  },
  apply: (t,o) => {t.typing = o; return t}
}

allRules.assumeRealOperator = {
  priority: -10,
  name: "Assume Real-valued Operator",
  match: t => {
    if(t.typing?.binop?.textContent == "\\to" && t.typing.right.textContent == "?"){
      return true
    }
  },
  apply: (t,o) => {t.typing.right = {textContent: "\\mathbb{R}"}; return t}
}

allRules.assumeInteger = {
  priority: -10,
  name: "Assume Integer",
  match: t => {
    if(t.typing?.textContent == "?" && (t.type == "mathord" || t.type == "textord") && !(t.value && !Number.isInteger(t.value.number))){
      return true
    }
  },
  apply: (t,o) => {t.typing = {textContent: "\\mathbb{Z}"}; return t}
}

allRules.assumeComplex = {
  priority: -10,
  name: "Assume Complex",
  match: t => {
    if(t.typing?.textContent == "?" && (t.type == "mathord" || t.type == "textord") && !(t.value && !(t.value.hasOwnProperty("real") && t.value.hasOwnProperty("imag")))){
      return true
    }
  },
  apply: (t,o) => {t.typing = {textContent: "\\mathbb{C}"}; return t}
}
allRules.assumeReal = {
  priority: -10,
  name: "Assume Real",
  match: t => {
    if(t.typing?.textContent == "?" && (t.type == "mathord" || t.type == "textord") && !(t.value && !t.value.hasOwnProperty("number"))){
      return true
    }
  },
  apply: (t,o) => {t.typing = {textContent: "\\mathbb{R}"}; return t}
}

const constants = [{symbol: "\\pi", value: {number: Math.PI}},{symbol: "e", value: {number: Math.E}},{symbol: "i", value: {real: 0, imag: 1}}]

allRules.constantValue = {
  priority: 100,
  name: "Constant Literal",
  match: t => {
    if(t.value || !t.textContent){return}
    for(let c of constants){
      if(t.textContent == c.symbol){
        return clone(c.value)
      }
    }
  },
  apply: (t,o) => {t.value = o; return t}
}
allRules.numberLiteralValue = {
  priority: 100,
  name: "Number Literal",
  match: t => {
    if(t.value){return}
    return numberLiteral(t)
  },
  apply: (t,o) => {t.value = {number: o}; return t}
}

const mkBinopType = (l,r,o) => {return {binop: {textContent: "\\to"}, left: {binop: {textContent: "\\times"}, left: l, right: r}, right: o}}
const emptyBinopType = mkBinopType({textContent: "?"}, {textContent: "?"}, {textContent: "?"})

allRules.assumeEqualSignType = {
  priority: 100,
  name: "Assume Equal Sign Type",
  match: t => {
    if(t.binop?.textContent == "=" && objectMatches(emptyBinopType,t.binop.typing)){
      return true
    }
  },
  apply: (t,o) => {
    t.binop.typing.left.left = {textContent: "\\text{Set}"}
    t.binop.typing.left.right = {textContent: "\\text{Set}"}
    t.binop.typing.right = {textContent: "\\text{STATEMENT}"}
    return t
  }
}

allRules.assumeSetBinopType = {
  priority: 100,
  name: "Assume Set Binop Type",
  match: t => {
    if((t.binop?.textContent == "\\times" || t.binop?.textContent == "\\to") && objectMatches(emptyBinopType,t.binop.typing)){
      return true
    }
  },
  apply: (t,o) => {
    t.binop.typing.left.left = {textContent: "\\text{Set}"}
    t.binop.typing.left.right = {textContent: "\\text{Set}"}
    t.binop.typing.right = {textContent: "\\text{Set}"}
    return t
  }
}

allRules.annotateOperatorType = {
  priority: -100,
  name: "Unknown Operator Type",
  match: t => {
    if(t.operator && !t.operator.typing){
      return true
    }
  },
  apply: (t,o) => {t.operator.typing = {binop: {textContent: "\\to"}, left: {textContent: "?"}, right: {textContent: "?"}}; return t}
}

allRules.annotateUnknownType = {
  priority: -50,
  name: "Unknown Type",
  match: t => {
    if((t.type == "mathord" || t.type == "textord" || t.base?.type == "mathord" || t.base?.type == "textord" || t.operator) && !t.typing){
      return true
    }
  },
  apply: (t,o) => {t.typing = {textContent: "?"}; return t}
}


allRules.annoteBinopType = {
  priority: -100,
  name: "Unknown Binop Type",
  match: t => {
    if(t.binop && !t.binop.typing && t.binop.textContent != "\\to"){
      return true
    }
  },
  apply: (t,o) => {t.binop.typing = clone(emptyBinopType); return t}
}

allRules.inferOperatorTyping = {
  priority: 50,
  name: "Infer operator typing",
  match: t => {
    if(t.operator?.typing?.binop?.textContent == "\\to" && t.operator.typing.left.textContent == "?" && t.argument.typing){
      return clone(t.argument.typing)
    }
  },
  apply: (t,o) => {
    t.operator.typing.left = o
    return t
  }
}

allRules.inferBinopTypingLeft = {
  priority: 50,
  name: "Infer binop typing (left)",
  match: t => {
    if(t.binop?.typing?.binop?.textContent == "\\to" && t.binop.typing.left.binop?.textContent == "\\times" && t.binop.typing.left.left?.textContent == "?" && t.left.typing){
      return clone(t.left.typing)
    }
  },
  apply: (t,o) => {
    t.binop.typing.left.left = o
    return t
  }
}

allRules.inferBinopTypingRight = {
  priority: 50,
  name: "Infer binop typing (right)",
  match: t => {
    if(t.binop?.typing?.binop?.textContent == "\\to" && t.binop.typing.left.binop?.textContent == "\\times" && t.binop.typing.left.right?.textContent == "?" && t.right.typing){
      return clone(t.right.typing)
    }
  },
  apply: (t,o) => {
    t.binop.typing.left.right = o
    return t
  }
}

allRules.unfurlParen = {
  priority: 0,
  name: "Unfurl paren",
  match: t => {
    return t.paren
  },
  apply: (t,o) => o
}

validRules.recognizeOperator = {
  priority: 100,
  name: "Recognize operator",
  match: t => {
    var operator
    if(!Array.isArray(t)){return}
    var opIdx = t.findIndex(x => x.type == "op" || x.base?.type == "op")
    var operator = t[opIdx]
    if(operator && opIdx < t.length - 1 && !(t.length == 2 && t[1].paren)){
      //if(t[opIdx + 1]?.paren){
       // return {op: operator, arg: t[opIdx+1], left: t.slice(0,opIdx), rest: t.slice(opIdx + 2)}
      //}
      return {op: operator, arg: matchApply(validRules.singletonArrayReduce,t.slice(opIdx+1)), left: t.slice(0,opIdx)}
    }
  },
  apply: (t,o) => {
    o.left.push({operator: o.op, argument: o.arg})
    if(o.rest){
      o.left = o.left.concat(o.rest)
    }
    return matchApply(validRules.singletonArrayReduce,o.left)
  }
}

validRules.recognizeParenOperator = {
  priority: 100,
  name: "Recognize paren operator",
  match: t => {
    var operator
    if(!Array.isArray(t)){return}
    var parenIdx = t.findIndex(x => x.paren)
    var operator = t[parenIdx - 1]
    if(operator){
      return {op: operator, arg: t[parenIdx].paren, left: t.slice(0,parenIdx - 1), rest: t.slice(parenIdx + 1)}
    }
  },
  apply: (t,o) => {
    o.left.push({operator: o.op, argument: o.arg})
    if(o.rest){
      o.left = o.left.concat(o.rest)
    }
    return matchApply(validRules.singletonArrayReduce,o.left)
  }
}

validRules.recognizeEquation = {
  priority: 100,
  name: "Recognize eq",
  match: t => {
    if(Array.isArray(t) && t.length > 2){
      var eqIndex = t.findIndex(x => x.textContent == "=")
      if(eqIndex && 0 < eqIndex && eqIndex < t.length - 1){
        return {lhs: t.slice(0,eqIndex), rhs: t.slice(eqIndex + 1)}
      }
    }
  },
  apply: (t,o) => deepApply(validRules.singletonArrayReduce,{binop: {textContent: "=", origin: "Recognized equality"}, left: o.lhs, right: o.rhs})
}

validRules.recognizeTypeAnnotation = {
  priority: 100,
  name: "Recognize annotation",
  match: t => {
    if(Array.isArray(t) && t[1]?.textContent == ":" && t.length > 2){
      return clone({val: t[0], typ: t.slice(2)})
    }
  },
  apply: (t,o) => {
    var out = {typing: matchApply(validRules.singletonArrayReduce,o.typ)}
    Object.assign(out,o.val)
    return out
  }
}

Object.assign(allRules,validRules)
sortedRules = Object.values(allRules).sort((a,b) => a.priority - b.priority)

function matchApply(rule,t){
  var res = rule.match(clone(t))
  if(res){
    return rule.apply(t,res)
  }
  return t
}

function deepMatch(rule,t){
  var found = false
  traverseSubExprs(t,(o,p,c) => {
    if(rule.match(o[p])){
      found = true
    }
  })
  return rule.match(t) || found
}

function deepApply(rule,t){
  t = matchApply(rule,t)
  traverseSubExprs(t, (o,p,c) => {
    o[p] = matchApply(rule,o[p])
  })
  return t
}



function collapseString(tree){
  var str = ""
  traverseCrumbs(tree,(x,p,c) => {if(p == "textContent"){str += x[p]}})
  return str
}

function numberLiteral(tree){
  var stringVersion = ""
  if(tree.textContent){
    stringVersion = tree.textContent
  }else if(Array.isArray(tree)){
    tree.forEach(x => stringVersion += x.textContent)
  }
  var numVersion = Number(stringVersion)
  if(!Number.isNaN(numVersion))
    return numVersion
}

function partialDerivative(x){
  return {objectName: "partial", data: {variable: x}}
}

function clone(o){
  return JSON.parse(JSON.stringify(o))
}

function traverseSubExprs(o,f,c=[]){
  if(Array.isArray(o)){
    o.forEach((x,i) => {
      c.push(i)
      f(o,i,c)
      traverseSubExprs(o[i],f,c)
      c.pop()
    })
  }else if(typeof o === 'object'){
    for(var prop in o){
      c.push(prop)
      f(o,prop,c)
      traverseSubExprs(o[prop],f,c)
      c.pop()
    }
  }
}

function objectMatches(a,b){
  if(typeof a === 'object'){
    for(let prop in a){
      if(!b || !objectMatches(a[prop],b[prop])){
        return false
      }
    }
    return true
  }
  return a == b
}

function traverseCrumbs(o,f,c=[]){
  for(let prop in o){
    c.push(prop)
    if(typeof o[prop] === 'object'){
      traverseCrumbs(o[prop],f,c)
    }else{
      f(o,prop,c)
    }
    c.pop()
  }
}
