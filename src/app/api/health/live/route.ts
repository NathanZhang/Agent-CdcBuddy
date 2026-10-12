export const dynamic='force-dynamic';export async function GET(){return Response.json({alive:true},{headers:{'Cache-Control':'no-store'}});}
