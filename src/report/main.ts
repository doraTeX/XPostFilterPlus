import {t,language} from '../shared/i18n';
import {call} from '../shared/client';
import {fillReport} from '../shared/report';
import './style.css';
document.documentElement.lang=language();document.title=t('reportTitle');document.querySelector('h1')!.textContent=t('reportTitle');
document.body.classList.add('report-page');
const id=new URL(location.href).searchParams.get('id');
void call('REPORT_DATA',{id}).then(data=>fillReport(document.getElementById('report')!,data.rows||[],data)).catch(e=>{document.getElementById('report')!.textContent=e.message;});
