'use client';
import React from 'react';
import {ThinkingProcessCard} from './ThinkingProcessCard';
import {MarkdownRenderer} from './MarkdownRenderer';
import type {WorkbenchMessage} from '@/features/workbench/workbench-controller';

export function ChatMessageContent({message}:{message:WorkbenchMessage}){
 return <>
  {message.sender==='agent'&&<ThinkingProcessCard reasoningText={message.reasoningText ?? ''} isStreaming={message.reasoningStreaming} isPending={Boolean(message.streaming||message.reasoningStreaming)} durationMs={message.reasoningDuration} interrupted={message.interrupted}/>}
  {message.text&&<MarkdownRenderer content={message.text} isUser={message.sender==='user'}/>}
  {message.streaming&&message.text&&<span aria-label="正在生成答复" className="mt-1 inline-block h-3 w-1 animate-pulse rounded bg-sky-500"/>}
 </>;
}
