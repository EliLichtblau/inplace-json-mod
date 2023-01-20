use regex::Regex;
use std::{fs, collections::LinkedList};

#[derive(Debug, PartialEq)]
enum Token {
    Word(String),
    WhiteSpace(String),
    EscapedItem(String),
    Number(String), 
    Quote,
    LBrace,
    RBrace,
    LBracket,
    RBracket,
    Colon,
    Comma,
    Boolean(String)
}


fn lexer(content: &String) -> LinkedList<Token>{
    let word = Regex::new(r#"^[^<!\\"]+"#).expect("wtf");
    let number = Regex::new(r"^[\d]+").unwrap();
    let boolean = Regex::new(r"^(true)|(false)").unwrap();
    let whitespace = Regex::new(r"^([\s]+)").expect("wtf");
    let escaped = Regex::new(r"^(\\.)").expect("wtf");
    let quote = Regex::new(r#"^""#).expect("wtf");
    let rbrace = Regex::new("^\\}").expect("wtf");
    let lbrace = Regex::new("^\\{").expect("wtf");
    let rbracket = Regex::new("^\\]").expect("wtf");
    let lbracket = Regex::new("^\\[").expect("wtf");
    let colon = Regex::new("^:").expect("wtf");
    let comma = Regex::new("^,").expect("wtf");
    let mut vec: LinkedList<Token> = LinkedList::new();

    let mut loc = 0;
    while loc < content.len() {
        if escaped.is_match(&content[loc..content.len()]) {
            let matched = escaped.captures(&content[loc..content.len()]).unwrap().get(0).map(|m| m.as_str()).unwrap();
            vec.push_back(Token::EscapedItem(matched.to_string()));
            loc += matched.len()
            
        } else if whitespace.is_match(&content[loc..content.len()]) {
            let matched = whitespace.captures(&content[loc..content.len()]).unwrap().get(0).map(|m| m.as_str()).unwrap();
            vec.push_back(Token::WhiteSpace(matched.to_string()));
            loc += matched.len()

        } else if escaped.is_match(&content[loc..content.len()]) {
            let matched = escaped.captures(&content[loc..content.len()]).unwrap().get(0).map(|m| m.as_str()).unwrap();
            vec.push_back(Token::EscapedItem(matched.to_string()));
            loc += matched.len()
            
        } else if boolean.is_match(&content[loc..content.len()]) {
            let matched = boolean.captures(&content[loc..content.len()]).unwrap().get(0).map(|m| m.as_str()).unwrap();
            vec.push_back(Token::Boolean(matched.to_string()));
            loc += matched.len()
            
        } else if lbracket.is_match(&content[loc..content.len()]) {
            vec.push_back(Token::LBracket);
            loc += 1

        } else if rbracket.is_match(&content[loc..content.len()]) {
            vec.push_back(Token::RBracket);
            loc += 1

        } else if quote.is_match(&content[loc..content.len()]) {
            vec.push_back(Token::Quote);
            loc += 1
        } else if lbrace.is_match(&content[loc..content.len()]) {
            vec.push_back(Token::LBrace);
            loc += 1

        } else if rbrace.is_match(&content[loc..content.len()]) {
            vec.push_back(Token::RBrace);
            loc += 1

        } else if colon.is_match(&content[loc..content.len()]) {
            vec.push_back(Token::Colon);
            loc += 1

        } else if comma.is_match(&content[loc..content.len()]) {
            vec.push_back(Token::Comma);
            loc += 1

        }else if number.is_match(&content[loc..content.len()]) {
            let matched = number.captures(&content[loc..content.len()]).unwrap().get(0).map(|m| m.as_str()).unwrap();
            vec.push_back(Token::Number(matched.to_string()));
            loc += matched.len()

        } 
        else if word.is_match(&content[loc..content.len()]) {
            let matched = word.captures(&content[loc..content.len()]).unwrap().get(0).map(|m| m.as_str()).unwrap();
            vec.push_back(Token::Word(matched.to_string()));
            loc += matched.len()

        } else {
            println!("Error: {}", &content[loc..content.len()]);
            println!("Vec: {:?}", vec);
            panic!("This should be unreachable")
        }
    }


    return vec
}




#[derive(Debug)]
enum Expr {
    //Top(Box<Expr>),
    Value(String),
    Pair(String, Box<Expr>),
    NoOp,
    Statement(Vec<Expr>),
    Array(Vec<Expr>)
}





/**
 * S => { Key Statement}
 * Statement => statemnt_no_comma , | statement_no_comma }
 * statement_no_comma => String | S
 * 
 */
/**
 * parse_S
 * getKey
 * const stmt_no_comam = parseStatement
 * pair = (key, stmt_no_comma)
 * if no comma
 *      return pair
 * else:
 *      collect = Statement(vec![pair])
 *      next_stmt = parse_S
 *      if next_stmt is Statement -> collect.extend(next)
 *      else: collect.push(next)
 *      
 * 
 */

fn parse_s(tokens: &mut LinkedList<Token>) -> Expr {
    let top = tokens.front();
    if top == Some(&Token::LBracket) {
        return parse_array(tokens)
    }
    if top != Some(&Token::LBrace) {
        panic!("Parse_S expecteds {{ or [")
    }
    tokens.pop_front();
    // Todo: init with type
    let mut top_level = vec![Expr::NoOp];
    top_level.pop();
    loop {
        match parse_kv_statement_no_comma(tokens) {
            Expr::NoOp => break,
            Expr::Pair(key, value) => {
                top_level.push(Expr::Pair(key, value));
                if tokens.front() == Some(&Token::Comma) {
                    tokens.pop_front();
                } 
            },
            _ => panic!("Parse s failure")
        }
        
    }
    return Expr::Statement(top_level)
}

fn parse_kv_statement_no_comma(tokens: &mut LinkedList<Token>) -> Expr {
    pop_white_space(tokens);
    match tokens.front() {
        Some(Token::Quote) => {
            let key = parse_key(tokens);
            let value = parse_value_statement_no_comma(tokens);
            pop_white_space(tokens);
            return Expr::Pair(key, Box::new(value))
        }
        Some(Token::RBrace) => {
            tokens.pop_front();
            return Expr::NoOp
        },
        
        Some(Token::LBrace) => {
            tokens.pop_front();
            return parse_s(tokens)
        },
        /*Some(Token::LBracket) => {
            //tokens.pop_front();
            return parse_array(tokens)
        }*/
        
        _ => {
            println!("toks: {:?}", tokens);
            panic!("kv_statment no comma parse error")
        }
    }
}


fn parse_value_statement_no_comma(tokens: &mut LinkedList<Token>) -> Expr {
    pop_white_space(tokens);
    match tokens.front() {
        Some(Token::LBrace) => {
            return parse_s(tokens)
        },
        Some(Token::Quote) => {
            tokens.pop_front();
            let v =  Expr::Value(parse_string(tokens));
            pop_white_space(tokens);
            return v
        },
        Some(Token::Number(n)) => {
            let v = Expr::Value(n.to_owned());
            tokens.pop_front();
            pop_white_space(tokens);
            return v
        },
        Some(Token::Boolean(b)) => {
            let v = Expr::Value(b.to_owned());
            tokens.pop_front();
            pop_white_space(tokens);
            return v
        },
        Some(Token::LBracket) => {
            return parse_array(tokens)
        },
        Some(Token::RBracket) => {
            tokens.pop_front();
            return Expr::NoOp;
        }
        _ => {
            println!("tokens: {:?}", tokens);
            panic!("wtf man")
            
        }
    }
}


fn parse_array(tokens: &mut LinkedList<Token>) -> Expr {
    let top = tokens.pop_front();
    
    if top != Some(Token::LBracket) {
        panic!("parse_array expecteds [")
    }
    
    // Todo: init with type
    let mut top_level = vec![Expr::NoOp];
    top_level.pop();
    loop {
        let value = parse_value_statement_no_comma(tokens); 
        match &value {
            Expr::Value(v) => top_level.push(Expr::Value(v.to_string())),
            Expr::Pair(_, _) => panic!("Arrays are only values not keys"),
            Expr::NoOp => break,
            Expr::Statement(_) => top_level.push(value),
            Expr::Array(_) => top_level.push(value),
        }
        pop_white_space(tokens);
        if tokens.front() == Some(&Token::Comma) {
            tokens.pop_front();
        } 
    }
    
    return Expr::Array(top_level)
}



fn parse_key(tokens: &mut LinkedList<Token>) -> String{
    pop_white_space(tokens);
    let quote = tokens.pop_front();
    if quote != Some(Token::Quote) {
        panic!("Expcted quote")
    }
    let s = parse_string(tokens);
    pop_colon(tokens);
    return s
}

fn pop_white_space(tokens: &mut LinkedList<Token>) -> String {
    match tokens.front() {
        Some(Token::WhiteSpace(w)) => {
            let spaces = w.to_owned();
            tokens.pop_front();
            match tokens.front() {
                Some(Token::WhiteSpace(_)) => panic!("white spaces can't be adjacent???"),
                _ => {}
            }
            return spaces
        }
        _ => {
            return "".to_owned()
        }
    }
}
fn pop_colon(tokens: &mut LinkedList<Token>) {
    pop_white_space(tokens);
    if tokens.pop_front() != Some(Token::Colon) {
        println!("toks: {:?}", tokens);
        panic!("Expected :")
    }
    pop_white_space(tokens);
}


fn parse_string(tokens: &mut LinkedList<Token>) -> String {
    fn helper(toks: &mut LinkedList<Token>) -> String {
        match toks.pop_front() {
            Some(Token::Word(s)) => {
                return s.to_owned() + &helper(toks)
            },
            Some(Token::Boolean(s)) => {
                return s.to_owned() + &helper(toks)
            },
            Some(Token::WhiteSpace(s)) => {
                return s.to_owned() + &helper(toks)
            },
            Some(Token::EscapedItem(escaped)) => {
                return escaped.to_owned() + &helper(toks)
            },
            Some(Token::Quote) => {
                return "".to_string()
            },
            Some(Token::LBrace) => {
                return "{".to_string() + &helper(toks)
            },
            Some(Token::RBrace) => {
                return "}".to_string() + &helper(toks)
            },
            Some(Token::Colon) => {
                return ":".to_string() + &helper(toks)
            },
            Some(Token::Comma) => {
                return ",".to_string() + &helper(toks)
            },
            Some(Token::Number(n)) => {
                return n.to_owned() + &helper(toks)
            },
            Some(Token::LBracket) => {
                return "[".to_string() + &helper(toks)
            },
            Some(Token::RBracket) => {
                return "]".to_string() + &helper(toks)
            },
            None => panic!("oopsies")
        }
    }
    return helper(tokens)
}




fn print(expr: &Expr) -> String {
    match expr {
        Expr::Value(v) => return v.to_owned(),
        Expr::Pair(k, v) =>  {
            let value = print(v);
            match **v {
               
                Expr::Statement(_) => {
                    return format!(r#""{key}": {value}"#,key=k, value=value)
                },
                Expr::Array(_) => {
                    return format!(r#""{key}": {value}"#,key=k, value=value)
                },
                _ => return format!(r#""{key}": "{value}""#,key=k, value=value),
              
                
            }
            
        }
        Expr::NoOp => return "".to_owned(),
        Expr::Statement(v) => {
            let printed = v.iter().map(print).filter(|x| !x.is_empty()).collect::<Vec<String>>();
            return format!("{{{}}}" ,printed.join(","))
        },
        Expr::Array(v) => {
            let printed = v.iter().map(print).filter(|x| !x.is_empty()).collect::<Vec<String>>();
            return format!("[{}]" ,printed.join(","))
        }
    }
}


fn delete_path(expr: Expr, key_path: &mut LinkedList<String>) -> Expr{
    match expr {
        Expr::Value(_) => expr,
        Expr::Pair(k, v) => {
            if Some(&k.to_string()) == key_path.front().to_owned() {
                if key_path.len() == 1 {
                    return Expr::NoOp;
                }
                key_path.pop_front();

                return Expr::Pair(k, Box::new(delete_path(*v, key_path)))
                
            }
            return Expr::Pair(k, Box::new(delete_path(*v, key_path)))
        },
        Expr::NoOp => expr,
        Expr::Statement(s) => {
            let m = s.into_iter().map(|e|
                delete_path(e, key_path)).collect::<Vec<Expr>>();
            return Expr::Statement(m)

        },
        Expr::Array(_) => return expr,
    }
}



fn main() {
    let contents = fs::read_to_string("./testing/complex.jsonc").expect("file doesn't exist");
    //let rbrace = Regex::new("^\\{").expect("wtf");
    //println!("contents: {:?}", rbrace.is_match(&contents));
    let mut vec = lexer(&contents);
    //println!("contents: {:?}\n\n", contents);

    //println!("contents: {:?}\n\n", vec);
    //println!("contents: {:?}", vec[0]);
    let expr = parse_s(&mut vec);
    let mut ll: LinkedList<String> = LinkedList::new();
    ll.extend(["meta".to_owned(), "disclaimer".to_owned()]);
    let expr = delete_path(expr, &mut ll);
    //println!("Hello, world!");
    //println!("expr: {:?}", expr);
    println!("{}", print(&expr))

}
