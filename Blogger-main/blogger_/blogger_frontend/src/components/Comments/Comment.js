import React, { useContext } from 'react'
import {useState,useRef,useEffect} from "react"
import {ReactComponent as DownArrow} from "../../assets/down-arrow.svg"
import {ReactComponent as UpArrow} from "../../assets/up-arrow.svg"
import { Action } from './Action'
import { AuthContext } from '../../context/auth-context'

const Comment = ({comment,handleInsertNode,handleDeleteNode,handleEditNode}) => {
  const [input,setInput]=useState("");
  const [editMode,setEditMode]=useState(false);
  const [showInput,setShowInput]=useState(false);
  const [expand,setExpand]=useState(true);
  const auth = useContext(AuthContext);
  const inputRef=useRef(null)
  const onAddComment=()=>{
    if(editMode){
      handleEditNode(comment._id,inputRef?.current?.innerText);
      setEditMode(false);
    }
    else {
      setExpand(true);
      console.log(input);
      handleInsertNode(comment._id,input);
      setShowInput(false);
      setInput("");
    }
  }
  useEffect(()=>{
    inputRef?.current?.focus();
  },[editMode]);
  const handleNewComment=()=>{
    setExpand(expand=>!expand);
    setShowInput(true);
  }
  const handleDelete=()=>{
    handleDeleteNode(comment._id)
  }
  return (
    <div>
        <div className={comment.parentId=="" ? "inputContainer":"commentContainer"}>
           {comment.parentId==""? ( 
           <>
           <input
            type='text'
            className='inputContainer__input first_input'
            placeholder='type..'
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            size={50}
            />
            <Action className="reply comment" type="COMMENT" disabled={!auth.isLoggedIn} handleClick={onAddComment}/>
            </>)
           :
           (
            <>
            <span 
            contentEditable={editMode}
            suppressContentEditableWarning= {editMode}
            style={{wordWrap: "break-word"}}
            ref={inputRef}
            >
              {comment.content}
            </span>
            <div style={{display: "flex",marginTop: "5px"}}>
                {editMode?(
                    <>
                        <Action className="reply" type="SAVE" handleClick={onAddComment} disabled={!auth.isLoggedIn}/>                    
                        <Action className="reply" type="CANCEL" disabled={!auth.isLoggedIn} handleClick={()=>{
                          if(inputRef.current){
                            inputRef.current.innerText=comment.content
                          }
                          setEditMode(false)}}/>                    
                    </>):
                    <>
                    <Action 
                    className="reply" 
                    type={
                        <>
                        {expand?
                        <UpArrow width="10px" height="10px"/>:
                        <DownArrow width="10px" height="10px"/>}
                        {" "}REPLY
                        </>
                    } 
                    handleClick={handleNewComment}/>
                    <Action className="reply" type="EDIT" disabled={!auth.isLoggedIn || auth.userId!=comment.creator} handleClick={()=>setEditMode(true)}/>
                    <Action className="reply" type="DELETE" disabled={!auth.isLoggedIn || auth.userId!=comment.creator} handleClick={handleDelete}/>
                    </>
                }
            </div>
            </>
           )}
        </div>
        <div style={{ display:expand?"block":"none",paddingLeft: 25}}>
            {showInput && 
                <div className='inputContainer'>
                    <input type="text" className="inputContainer__input" autoFocus onChange={e=>setInput(e.target.value)} size={35}/>
                    <Action className="reply" type="REPLY" disabled={!auth.isLoggedIn} handleClick={onAddComment}/>
                    <Action
                     className="reply"
                     disabled={!auth.isLoggedIn}
                      type="CANCEL"
                      handleClick={()=>{
                        setShowInput(false);
                        if(Object.keys(comment?.children)?.length )setExpand(false);
                      }} />
                </div>
            }
            {/* {console.log(Object.values(comment?.children))} */}
        {Object.values(comment?.children)?.map((cmnt)=>{
            return <Comment 
            key={cmnt._id} 
            comment={cmnt}
            handleDeleteNode={handleDeleteNode}
            handleEditNode={handleEditNode}
            handleInsertNode={handleInsertNode}/>
        })}
        </div>
    </div>
  )
}

export default Comment