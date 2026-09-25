import React from 'react';
import {render,screen,waitFor} from '@testing-library/react';
import ClassicBattlePage from './ClassicBattlePage';
jest.mock('react-router-dom',()=>({useLocation:()=>({key:'fixture',state:{matchState:{matchId:'fixture'}}}),useNavigate:()=>jest.fn()}),{virtual:true});
jest.mock('../../UserContext',()=>({useUser:()=>({user:{token:'test'}})}));
jest.mock('../template/TemplatePage',()=>({__esModule:true,default:({children})=><div>{children}</div>}));
const result={matchId:'fixture',finished:true,result:'win',player:{name:'Pet thử',image:'test.png',level:2,final_stats:{hp:100,mp:50,str:12,def:10,spd:9,intelligence:8}},enemy:{name:'Boss thử'},reward:{expGained:400,levelUp:true,newLevel:2,loot:[{item_id:0,quantity:25}]}};
afterEach(()=>{jest.restoreAllMocks();sessionStorage.clear();});
test('victory replaces arena and shows only server-confirmed rewards',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({active:false})}).mockResolvedValueOnce({ok:true,json:async()=>result});
 render(<ClassicBattlePage/>);
 expect(await screen.findByRole('heading',{name:'Chiến thắng!'})).toBeInTheDocument();
 expect(screen.getByText('400')).toBeInTheDocument();
 expect(screen.queryByRole('combobox',{name:'Hành động'})).not.toBeInTheDocument();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.getAllByRole('img')).toHaveLength(1);
});
test('defeat also replaces arena and does not display invented winnings',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>({active:false})}).mockResolvedValueOnce({ok:true,json:async()=>({...result,result:'lose',reward:{expGained:0,loot:[]}})});
 render(<ClassicBattlePage/>);
 await waitFor(()=>expect(screen.getByRole('heading',{name:'Thất bại'})).toBeInTheDocument());
 expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
 expect(screen.queryByText('400')).not.toBeInTheDocument();
});
