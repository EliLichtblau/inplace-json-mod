import { match, P } from 'ts-pattern';
import {readFileSync} from "fs"

const WORD = /^[^<!("|\*\/)|\s|\n]+/
const WHITESPACE = /^[\s\n]+/
const NUMBER = /^(([\d]+(?:\.[\d]+)?))(e[\d]+)?/ // this should get all valid floats

const BOOL = /^(true)|(false)/
const ESCAPED = /^\./
const QUOTE = /^"/

const LBRACE = /^{/
const RBRACE = /^}/
const LBRACKET = /^\[/

const MULTILINE_LCOMMENT = /^\/\*/
const MULTILINE_RCOMMENT = /^\*\//
const COMMENT = /^\/\// 

const RBRACKET = /^]/
const COLON = /^:/
const COMMA = /^,/

type Token = 
    | {type: "Word"; content: string}
    | {type: "WhiteSpace"; content: string}
    | {type: "Number"; content: string}
    | {type: "Bool"; content: string}
    | {type: "Escaped"; content: string}
    | {type: "Quote"; content: string}
    | {type: "LBracket"; content: string}
    | {type: "RBracket"; content: string}
    | {type: "LBrace"; content: string}
    | {type: "RBrace"; content: string}
    | {type: "Colon"; content: string}
    | {type: "Comma"; content: string}
    | {type: "LComment"; content: string}
    | {type: "RComment"; content: string}
    | {type: "SComment"; content: string}


// todo: don't use substring
function lexer(json: string) {
    let loc = 0;
    const tokens: Token[] = []
    let m: RegExpMatchArray | null = null
    while (loc < json.length) {
        if ( (m = json.substring(loc).match(WHITESPACE)) != null ) {
            tokens.push({type: "WhiteSpace", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(NUMBER)) != null ) {
            tokens.push({type: "Number", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(BOOL)) != null ) {
            tokens.push({type: "Bool", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(ESCAPED)) != null ) {
            tokens.push({type: "Escaped", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(QUOTE)) != null ) {
            tokens.push({type: "Quote", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(LBRACE)) != null ) {
            tokens.push({type: "LBrace", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(RBRACE)) != null ) {
            tokens.push({type: "RBrace", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(LBRACKET)) != null ) {
            tokens.push({type: "LBracket", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(RBRACKET)) != null ) {
            tokens.push({type: "RBracket", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(COLON)) != null ) {
            tokens.push({type: "Colon", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(COMMA)) != null ) {
            tokens.push({type: "Comma", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(MULTILINE_LCOMMENT)) != null ) {
            tokens.push({type: "LComment", content: m[0]})
            loc += m[0].length
        }else if ( (m = json.substring(loc).match(MULTILINE_RCOMMENT)) != null ) {
            tokens.push({type: "RComment", content: m[0]})
            loc += m[0].length
        }else if ( (m = json.substring(loc).match(COMMENT)) != null ) {
            tokens.push({type: "SComment", content: m[0]})
            loc += m[0].length
        } else if ( (m = json.substring(loc).match(WORD)) != null ) {
            tokens.push({type: "Word", content: m[0]})
            loc += m[0].length
        } else {
            throw Error("Unknown char")
        }

    }

    return tokens
}

type SpacingInfo = {beforeValue: string, afterValue: string, comma?: string}
type KVPairExpr = {type: "KVPair"; beforeKey: string, key: string, afterKeyBeforeColon: string, value: Exclude<Expression, {type: "KVPair"}>}
type StatementExpr = {type: "Statement";  expressions: Expression[]} & SpacingInfo
type ArrayExpr = {type: "Array";  expressions: Expression[]} & SpacingInfo
type ValueExpr = {type: "Value"; value: string} & SpacingInfo
type Expression = 
| KVPairExpr
| StatementExpr
| ArrayExpr
| ValueExpr

function parse(tokens: Token[]): ArrayExpr | StatementExpr {
    const begin_spacing = pop_white_space(tokens)
    return match(tokens.shift())
        .with({type: P.union("LBrace", "LBracket")}, (t)=>{
            return helper(t.type)
        })
        .otherwise((t)=>{
            // todo: should actually parse arbitrary but I'm lazy so I will write a hack in the addKey
            throw Error("help me")
        })
    // type safe way of specifying types?
    function helper(tokenType: "LBracket" | "LBrace") {
        const memberFunc = (tokenType === "LBracket") ?  parse_value : parse_key_value
        // type safe way of doing this?
        const closingToken = (tokenType === "LBracket") ? "RBracket" : "RBrace"
        const exprType = (tokenType === "LBracket") ? "Array" : "Statement"
        if (assert_token_type(tokens, closingToken)) {
            tokens.shift()
            const expr: StatementExpr | ArrayExpr = {type: exprType, expressions: [], beforeValue: begin_spacing, afterValue: pop_white_space(tokens)}
            return expr  
        }
        const expressions = [memberFunc(tokens)]
        while (assert_token_type(tokens, "Comma")) {
            tokens.shift()
            const comma = pop_white_space(tokens)
            match (expressions[expressions.length -1])
                .with({type: "KVPair"}, (kv)=>{
                    kv.value.comma =`,${comma}`
                }).otherwise((expr)=>{
                    expr.comma = `,${comma}`
                })
            expressions.push(memberFunc(tokens))
        }
        const ending = pop_white_space(tokens)
        if (!assert_token_type(tokens, closingToken)) {
            console.log(tokens)
            const msg = `must be ${closingToken}`
            throw Error(msg)
        }
        tokens.shift()
        const expr: StatementExpr | ArrayExpr = {type: exprType, expressions: expressions, beforeValue: begin_spacing, afterValue: ending}
        return expr
    }
}



function parse_key_value(tokens: Token[]): KVPairExpr {
    const space1 = pop_white_space(tokens)
    if (!assert_token_type(tokens, "Quote")) {
        console.log(tokens)
        throw Error("Key value must begin with quote")
    }
    const key = parse_string(tokens)
    const space2 = pop_white_space(tokens)
    if (!assert_token_type(tokens, "Colon")) {
        throw Error("Key value must be separated with :")
    }
    tokens.shift()
    const value = parse_value(tokens)
    const kv: KVPairExpr = {type: "KVPair", beforeKey: space1, key: key, afterKeyBeforeColon: space2, value: value} 
    return kv

}

function parse_value(tokens: Token[]): Exclude<Expression, {type: "KVPair"}> {
    const spaces1 = pop_white_space(tokens)
    return match(tokens[0])
        .with({type: "Quote"}, ()=>{
            const str = parse_string(tokens)
            const endingNoComma = pop_white_space(tokens)
            const value: ValueExpr = {type: "Value", value: str, beforeValue: spaces1, afterValue: endingNoComma}
            return value
        })
        .with({type: P.union("Bool", "Number")}, (b)=>{
            tokens.shift()
            const endingNoComma = pop_white_space(tokens)
            const value: ValueExpr = {type: "Value", beforeValue: spaces1, value: b.content, afterValue: endingNoComma} 
            return value
        })
        .with({type: P.union("LBrace", "LBracket")}, ()=>{
            const p = parse(tokens)
            p.beforeValue = spaces1
            const ending = pop_white_space(tokens)
            p.afterValue = ending
            return p
        })
        .otherwise(()=>{
            console.log(tokens)
            throw Error("Unexpected token in parse value")
        })
}


function parse_multi_comment(tokens: Token[]) {
    if (!assert_token_type(tokens, "LComment")) {
        console.log(tokens)
        throw Error("Multiline comment beings with /*")
    }
    tokens.shift()
    const ret: string[] = []
    while (!assert_token_type(tokens, "RComment")) {
        match(tokens[0])
            .with({type: "RComment"}, ()=>{}) //break case
            .otherwise((w)=>{
                ret.push(w?.content || "")
                tokens.shift()
            })
    }
    tokens.shift()
    return `/*${ret.join("")}*/`
}

function parse_string(tokens: Token[]) {
    if (!assert_token_type(tokens, "Quote")) {
        console.log(tokens)
        throw Error("Expected quote to begin string")
    }
    tokens.shift()
    const ret: string[] = []
    while (!assert_token_type(tokens, "Quote")) {
        match(tokens[0])
            .with({type: "Quote"}, ()=>{})//do nothing in this case
            .otherwise((w)=>{
                ret.push(w.content)
                tokens.shift()
            })
    }
    // pop off closing quote
    tokens.shift()
    // key should always be in strings
    return `"${ret.join('')}"`
}


function parse_line_comment(tokens: Token[]) {
    if (!assert_token_type(tokens, "SComment")) {
        throw Error("Expected comment to beign with //")
    }
    tokens.shift()
    const ret: string[] = []
    while (tokens.length > 0 && tokens[0].content.includes("\n")==false) {
        ret.push(tokens[0].content)
        tokens.shift()
    }
    return `//${ret.join("")}`
}

function pop_white_space(tokens: Token[]) {
    // white space includes all comment varieties
    // yes this means comments get associated with kv pairs which is silly but 
    // not worth the effort to fix
    const ret: string[] = []
    while (assert_token_type(tokens, "WhiteSpace") || assert_token_type(tokens, "LComment") 
            || assert_token_type(tokens, "SComment")) {
            match(tokens[0])
                .with({type: "WhiteSpace"}, (t)=>{
                    ret.push(t.content)
                    tokens.shift()
                })
                .with({type: "SComment"}, (t) => {
                    ret.push(parse_line_comment(tokens))
                })
                .with({type: "LComment"}, (t)=>{
                    ret.push(parse_multi_comment(tokens))
                })
                .otherwise(()=>"")
    }
    return ret.join("")
}


function assert_token_type(tokens: Token[], type: Token["type"]) {
    return tokens.length > 0 && tokens[0].type == type
}


function print(expr: Expression): string {
    return match(expr)
        .with({type: "KVPair"}, (k)=> {
            return `${k.beforeKey}${k.key}${k.afterKeyBeforeColon}:${print(k.value)}`
        })
        .with({type: "Statement"}, (stmt)=> {
            const statements = stmt.expressions.map(print).join("")
            return `${stmt.beforeValue}{${statements}}${stmt.afterValue}${stmt.comma || ""}`
        })
        .with({type: "Array"}, (arr)=> {
            const values = arr.expressions.map(print).join("")
            return `${arr.beforeValue}[${values}]${arr.afterValue}${arr.comma || ""}`
        })
        .with({type: "Value"}, (v)=> {
            return `${v.beforeValue}${v.value}${v.afterValue}${v.comma || ""}`
        })
        .exhaustive()
}



function get(expr: Expression, key: string) {
    return match(expr)
        .with({type: "Statement"}, (stmt)=> {
            for (const e of stmt.expressions) {
                const ret = match(e)
                    .with({type: "KVPair"}, (kv)=> {
                        if (kv.key==`"${key}"`) return kv.value
                        return undefined
                    })
                    .otherwise(()=> {return undefined})
                if (ret) return ret
            }
        })
        .otherwise(()=>{
            throw Error("Can only execute get on statement expression type")
        })
} 
function deleteKey(expr: Expression, key: string) {
    return match(expr)
        .with({type: "Statement"}, (stmt)=> {
            let i = 0
            for (const e of stmt.expressions) {
                const ret = match(e)
                    .with({type: "KVPair"}, (kv)=> {
                        if (kv.key==`"${key}"`) return stmt.expressions.splice(i, 1)
                        return undefined
                    })
                    .otherwise(()=> {return undefined})
                if (ret) return ret
    
                i++
            }
        })
        .otherwise(()=>{
            throw Error("Can only execute get on statement expression type")
        })
}

type JSONValue =
    | string
    | number
    | boolean
    | { [x: string]: JSONValue }
    | Array<JSONValue>;
function addKey(expr: Expression, key: string, value: JSONValue) {
    const val = match(value)
                .with(P.union(P.number, P.boolean), (v)=> {
                    // always push to top with comma
                    const ret: ValueExpr = {type: "Value", value: `${value}`, beforeValue:"", afterValue: "", comma: ","}
                    return ret
                })
                .with(P.string, (v)=> {
                    // always push to top with comma
                    const ret: ValueExpr = {type: "Value", value: `"${value}"`, beforeValue:"", afterValue: "", comma: ","}
                    return ret
                })
                .otherwise((t)=>{
                    return parse(lexer(JSON.stringify(t)))
                })
    return match(expr)
            .with({type: "Statement"}, (stmt)=>{
                const kv: KVPairExpr = {type: "KVPair", beforeKey: "", afterKeyBeforeColon: "", key: `"${key}"`, value: val}
                stmt.expressions.unshift(kv)
            }).otherwise(()=>{
                throw Error("Can only execute addKey on statement expression type")
            });
    
}


function main() {
    const text = readFileSync("testing/simple2.jsonc", {
        encoding: "utf-8"
    })

    const l = lexer(text)
    console.log(l)
    const p = parse(l)
    //console.log(p)
    const printed = print(p)
    console.log(printed)
    console.log(printed==text)
    console.log(get(p, "b"))
    deleteKey(p, "b")
    addKey(p, "newKey", "special")
    deleteKey(p, "newKey")
    console.log(print(p))
}
main()

 