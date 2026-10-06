import datetime, io
import openpyxl

def text(v):
    if v is None: return ''
    if isinstance(v,(datetime.datetime,datetime.date)): return v.strftime('%d/%m/')+str(v.year)
    return str(v).strip()

def parse_excel(source):
    book=openpyxl.load_workbook(source,data_only=True)
    records=[]; categories=[]
    for sheet in book:
        rows=list(sheet.values)
        if not any('ชื่อ-สกุล' in str(c) for row in rows[:5] for c in row): continue
        category=sheet.title.strip()
        categories.append({'name':category,'source_title':text(rows[0][0])})
        yearrow=next((r for r in rows[:5] if any(isinstance(v,(int,float)) and 2500<=v<=2700 for v in r[7:])),None)
        years={i:str(int(v)) for i,v in enumerate(yearrow or []) if i>=7 and isinstance(v,(int,float)) and 2500<=v<=2700}
        for idx,row in enumerate(rows):
            if len(row)<7 or text(row[6])!='เล่ม/เลข' or not any(row[i] is not None for i in (2,3,4)): continue
            history=[]
            for col,year in years.items():
                values=[text(rows[idx+offset][col]) if idx+offset<len(rows) and col<len(rows[idx+offset]) else '' for offset in range(3)]
                history.append(dict(year=year,number=values[0],renewed=values[1],expires=values[2]))
            records.append(dict(category=category,sequence=text(row[0]),code=text(row[1]),name=text(row[2]),address=text(row[3]),business=text(row[4]),fee=text(row[5]),notes='',history=history,source_row=idx+1))
    return {'categories':categories,'records':records}
