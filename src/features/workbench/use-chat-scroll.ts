'use client';

import {useEffect,useRef} from 'react';
import type {WorkbenchMessage} from './workbench-controller';

/** Follow visible replies, while leaving history reading and reasoning scrolling independent. */
export function useChatScroll(messages:WorkbenchMessage[],visible=true){
 const containerRef=useRef<HTMLDivElement>(null);
 const previousMessages=useRef<WorkbenchMessage[]>([]);
 const following=useRef(true);
 const wasVisible=useRef(false);

 useEffect(()=>{
  const previous=previousMessages.current;
  previousMessages.current=messages;
  const justOpened=visible&&!wasVisible.current;
  wasVisible.current=visible;
  const container=containerRef.current;
  if(!visible||!container)return;
  const newUserMessage=messages.some((message,index)=>message.sender==='user'&&message.id!==previous[index]?.id);
  // Hidden reasoning chunks and progress events must never move the conversation.
  const visibleReplyChanged=messages.length!==previous.length||messages.some((message,index)=>{
   const old=previous[index];
   return message.id!==old?.id||message.text!==old.text||message.skillUsed!==old.skillUsed||message.generativeView!==old.generativeView;
  });
  if(justOpened||newUserMessage||!messages.length)following.current=true;
  if((justOpened||visibleReplyChanged)&&following.current)container.scrollTop=container.scrollHeight;
 },[messages,visible]);

 const onScroll=()=>{
  const container=containerRef.current;
  if(container)following.current=container.scrollHeight-container.clientHeight-container.scrollTop<=24;
 };
 return {containerRef,onScroll};
}
