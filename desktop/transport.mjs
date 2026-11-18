// Transport — Bound private responses before parsing; tokens never leave the main process.
export async function responseBytes(response, limit) {
  if(Number(response.headers.get('content-length')||0)>limit)throw new Error('The service response is too large.');
  const chunks=[];let size=0;
  if(!response.body)throw new Error('The service returned an empty response.');
  const reader=response.body.getReader();
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
      if(size>limit)throw new Error('The service response is too large.');chunks.push(Buffer.from(value));}
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return Buffer.concat(chunks,size);
}
