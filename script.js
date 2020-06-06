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
      const reconstructedLatex = renderAsLatex(treeOut)
      console.log(reconstructedLatex)
      katex.render(reconstructedLatex,renderOut,{displayMode: true})
      for(let k in allRules){
        document.getElementById("ruleButton" + k).disabled = !deepMatch(allRules[k],treeOut)
      }
    }catch(e){
      renderOut.style.backgroundColor = "#ff7777"
      renderOut.innerHTML = e + " at line " + e.lineNumber
      return
    }
    renderOut.style.backgroundColor = "#77ff77"
  }
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
  const buttonDiv = document.getElementById("ruleButtons")
  for(let k in allRules){
    const button = document.createElement("button")
    button.className = "ruleButton"
    button.id = "ruleButton" + k
    console.log(allRules[k].name)
    button.addEventListener("click", e => {
      console.log(allRules[k].name)
      updateTree(() => deepApply(allRules[k],treeOut))
    })
    button.innerHTML = allRules[k].name
    buttonDiv.appendChild(button)
  }
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

// Render out our expression tree to latex
function renderAsLatex(tree){
  var out = ""
  if(Array.isArray(tree)){
    tree.forEach(x => {
      if(Array.isArray(x)){
        out += renderAsLatex({paren: x})
      }else{
        out += renderAsLatex(x)
      }
    })
  }
  else if(tree.paren){
    out += "\\left(" + renderAsLatex(tree.paren) + "\\right)"
  }
  else if(tree.ord){
    out += "{" + renderAsLatex(tree.ord) + "}"
  }
  else if(tree.partialVariable){
    out += "\\frac{\\partial}{\\partial " + renderAsLatex(tree.partialVariable) + "}"
  }
  else if(tree.binop){
    out += renderAsLatex(tree.left) + renderAsLatex(tree.binop) + renderAsLatex(tree.right)
  }
  else if(tree.operator){
    out += renderAsLatex(tree.operator) + renderAsLatex(tree.argument)
  }
  else if(tree.numer){
    out += "\\frac" + renderAsLatex(tree.numer) + renderAsLatex(tree.denom)
  }
  else if(tree.base){
    out += renderAsLatex(tree.base)
    if(tree.sub){
      out += "_" + renderAsLatex(tree.sub)
    }
    if(tree.sup){
      out += "^" + renderAsLatex(tree.sup)
    }
  }
  else if(tree.textContent){
    out += tree.textContent + " "
  }
  return out
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

additiveTemplate = {
  name: "Additivity",
  reqs: {operator: {typing: {additive: true}}, argument: {binop: {textContent: "+"}}},
  replace: {left: {operator: {template: ["operator"]}, argument: {template: ["argument","left"]}}, binop: {template: ["argument","binop"]}, right: {operator: {template: ["operator"]}, argument: {template: ["argument","right"]}}}
}

function ruleFromTemplate(template){
  return {
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

allRules.assumeJuxtIsCdotRule = {
  name: "Juxt to Cdot",
  match: t => {
    if(Array.isArray(t) && t.length > 1){
      return {left: t[0], right: t[1], rest: t.slice(2)}
    }
  },
  apply: (t,o) => {return matchApply(validRules.singletonArrayReduce,[{binop: {textContent: "\\cdot", origin: "Juxtaposition"}, left: o.left, right: o.right}].concat(o.rest))}
}

validRules.singletonArrayReduce = {
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
  name: "Recognize binop",
  match: t => {
    if(Array.isArray(t) && t.length == 3 && t[1].family == "bin"){
      return {left: t[0], binop: t[1], right: t[2]}
    }
  },
  apply: (t,o) => o
}

validRules.symbolicPartial = {
  name: "Symbolic Partial",
  match: t => {
    if(t.numer?.ord.textContent == "\\partial" && t.denom?.ord[0]?.textContent == "\\partial" && t.denom.ord.length > 1){
      return {variable: deepApply(validRules.singletonArrayReduce,t.denom.ord.slice(1))}
    }
  },
  apply: (t,o) => {return {partialVariable: o.variable, type: "op"}}
}

allRules.productRule = {
  name: "Product rule",
  match: t => {
    if(t.operator?.partialVariable && t.argument.binop?.textContent == "\\cdot"){
      return {variable: t.operator.partialVariable,prod: t.argument.left, rest: t.argument.right}
    }
  },
  apply: (t,o) => {
    var out = 
      {binop: {textContent: "+", origin: "Product rule"}
      ,left: {binop: {textContent: "\\cdot", origin: "Product rule"}, left: {paren: {operator: partialDerivative(o.variable), argument: o.prod}},right: o.rest}
      ,right: {binop: {textContent: "\\cdot", origin: "Product rule"}, left: o.prod,right: {paren: {operator: partialDerivative(o.variable), argument: o.rest}}}
      }
    return out
  }
}

const bigOperators = [{symbol: "\\sum", binop: "+", empty: "0"},{symbol: "\\prod", binop: "\\cdot", empty: "1"}]

validRules.expandBigOperator = {
  name: "Expand big operator",
  match: t => {
    for(const op of bigOperators){
      if(t.operator?.base?.textContent == op.symbol){
        var equals = t.operator?.sub.ord?.binop?.textContent
        if(equals != "="){return}
        var idx = t.operator.sub.ord.left
        var start = numberLiteral(t.operator.sub.ord.right).value
        var end = numberLiteral(t.operator.sup).value
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

allRules.inferOperatorTyping = {
  name: "Infer operator typing",
  match: t => {
    if(t.operator && !t.operator.typing && t.argument.typing){
      return t.argument.typing
    }
  },
  apply: (t,o) => {
    t.operator.typing = {domain: o}
    return t
  }
}

allRules.unfurlParen = {
  name: "Unfurl paren",
  match: t => {
    return t.paren
  },
  apply: (t,o) => o
}

validRules.recognizeOperator = {
  name: "Recognize operator",
  match: t => {
    var operator
    if(Array.isArray(t) && t[0]?.type == "op"){
      operator = t[0]
    }
    if(t[0]?.base?.type == "op")
      operator = t[0]
    if(operator){
      if(t[1]?.paren){
        return {op: operator, arg: t[1], rest: t.slice(2)}
      }
      return {op: operator, arg: matchApply(validRules.singletonArrayReduce,t.slice(1))}
    }
  },
  apply: (t,o) => {
    var out = {operator: o.op, argument: o.arg}
    if(o.rest){
      return matchApply(validRules.singletonArrayReduce,[out].concat(o.rest))
    }
    return out
  }
}

validRules.recognizeEquation = {
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

Object.assign(allRules,validRules)

function matchApply(rule,t){
  var res = rule.match(t)
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
  var stringVersion = collapseString(tree)
  var numVersion
  if(stringVersion.includes(".")){
    numVersion = parseFloat(stringVersion)
  }else{
    numVersion = parseInt(stringVersion)
  }
  return {value: numVersion}
}

function partialDerivative(x){
  return {partialVariable: x}
}

function clone(o){
  return JSON.parse(JSON.stringify(o))
}

function traverseSubExprs(o,f,c=[]){
  c.push(o)
  if(Array.isArray(o)){
    o.forEach((x,i) => {
      f(o,i,c)
      traverseSubExprs(o[i],f,c)
    })
  }else if(typeof o === 'object'){
    for(var prop in o){
      f(o,prop,c)
      traverseSubExprs(o[prop],f,c)
    }
  }
  c.pop()
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
