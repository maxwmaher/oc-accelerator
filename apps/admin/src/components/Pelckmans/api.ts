import { Tokens } from 'ordercloud-javascript-sdk'

export type OfferType = 'Bundle' | 'BuyThreePayTwo' | 'SegmentDiscount'
export interface Offer { id:string; name:string; type:OfferType; status:string; owner:string; revision:number; updatedAt:string; components:Component[]; rule?:Rule; history:{at:string;actor:string;action:string;comment?:string}[]; publicationError?:string; publishedResources?:Record<string,string> }
export interface Component { productId:string; title?:string; quantity:number; unitPrice:number; includedFree:boolean; required:boolean }
export interface Rule { selectorType:string; selectorId:string; minimumQuantity:number; discountPercent:number; productIds?:string[] }
export interface Document { offer:Offer; eTag:string }
const base=(import.meta.env.VITE_PELCKMANS_API_BASE_URL || '').replace(/\/$/,'')
async function call<T>(path:string,init?:RequestInit):Promise<T>{
  const token=Tokens.GetAccessToken(); if(!token) throw new Error('Sign in to use Bundles & Offers.')
  const response=await fetch(`${base}/api/pelckmans${path}`,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...init?.headers}})
  const body=await response.json().catch(()=>({})); if(!response.ok) throw new Error(body.error || `Request failed (${response.status})`); return body
}
export const api={ capabilities:()=>call<{username:string;editor:boolean;approver:boolean}>('/capabilities'), list:()=>call<Document[]>('/offers'), get:(id:string)=>call<Document>(`/offers/${id}`), create:(body:Partial<Offer>)=>call<Document>('/offers',{method:'POST',body:JSON.stringify(body)}), preview:(id:string)=>call<{lines:{title:string;quantity:number;unitPrice:number;discount:number}[];subtotal:number;discount:number;payable:number;label:string}>(`/offers/${id}/preview`,{method:'POST'}), action:(id:string,action:string,eTag:string,comment?:string)=>call<Document>(`/offers/${id}/${action}`,{method:'POST',body:JSON.stringify({eTag,comment})})}
