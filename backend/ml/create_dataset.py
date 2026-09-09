import csv
import os
import random

random.seed(42)

# Prefixes representing conversational filler phrases
fillers = [
    "", "", "",
    "i am rahul shamram i am fine so the problem is that ",
    "hello sir my name is rahul and ",
    "hi assistant i am fine, ",
    "good morning sir, ",
    "bhai listen ",
    "please help me, ",
    "i am reporting an issue that ",
    "in our area "
]

# Structured Template Specs for each department & subcategory
template_specs = {
    "Water Department": [
        # NO WATER SUPPLY
        ("there is no water supply in {loc}", "Water Supply", "No Water Supply", "HIGH"),
        ("no water supply in {loc} for {num} days", "Water Supply", "No Water Supply", "HIGH"),
        ("our taps have been completely dry in {loc} since {day}", "Water Supply", "No Water Supply", "HIGH"),
        ("water has stopped coming in {loc} since {day}", "Water Supply", "No Water Supply", "HIGH"),
        ("no water coming out of kitchen tap since {day}", "Water Supply", "No Water Supply", "HIGH"),
        ("there is a major water shortage in our colony near {loc}", "Water Supply", "No Water Supply", "HIGH"),
        ("bhai hamare area {loc} me {num} din se paani nahi aa raha hai", "Water Supply", "No Water Supply", "HIGH"),
        ("paani ki supply bilkul band hai {loc} me, please help karo", "Water Supply", "No Water Supply", "HIGH"),
        ("paani nahi aa raha ghar mein", "Water Supply", "No Water Supply", "HIGH"),
        ("there is water everywhere on the road but our taps have no water", "Water Supply", "No Water Supply", "HIGH"),
        
        # WATER PIPELINE LEAKAGE (Focus on overlapping vocabulary: road, water, pipe, leaking, flooding)
        ("water pipe is leaking near {loc} and road is full of water", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("pipeline burst near {loc} causing heavy water leakage on road", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("there is a road on that road there is a pipe that is leaking and road is full of water", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("broken water pipeline is flooding the street in {loc}", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("water is coming out of a broken pipe on the road near {loc}", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("water pipe is leaking continuously on the main road", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("pipe leakage near {loc} wasting clean drinking water", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("road is flooded because a water pipeline is leaking in {loc}", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("there is water on road due to broken pipeline near {loc}", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("water is leaking from main underground pipeline onto the street", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("water pipe leak ho gaya hai {loc} market ke paas", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("paani ki pipe leak ho gayi hai sadak par", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("sadak par pipe se paani leak ho raha hai aur paani jama ho gaya hai", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("pipeline phat gayi hai {loc} ke paas road par", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("pipeline leak hai aur paani road par jama ho raha hai", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("road par pipeline phat gayi hai", "Water Supply", "Water Pipeline Leakage", "HIGH"),
        ("paani sadak par beh raha hai pipe leak hone ki wajah se", "Water Supply", "Water Pipeline Leakage", "HIGH"),

        # CONTAMINATED / DIRTY WATER
        ("dirty brown water is coming from the tap in {loc}", "Water Supply", "Contaminated / Dirty Water", "HIGH"),
        ("muddy dirty water coming out of water taps in {loc}", "Water Supply", "Contaminated / Dirty Water", "HIGH"),
        ("contaminated foul smelling water in supply line near {loc}", "Water Supply", "Contaminated / Dirty Water", "HIGH"),
        ("ganda paani aa raha hai tap me {loc} ke andar", "Water Supply", "Contaminated / Dirty Water", "HIGH"),
        ("tap se ganda paani aa raha hai", "Water Supply", "Contaminated / Dirty Water", "HIGH"),

        # LOW WATER PRESSURE
        ("water pressure is extremely low in {loc}, cannot fill top tank", "Water Supply", "Low Water Pressure", "MEDIUM"),
        ("water comes with very poor low pressure in {loc}", "Water Supply", "Low Water Pressure", "MEDIUM"),
        ("water pressure is very low", "Water Supply", "Low Water Pressure", "MEDIUM")
    ],
    "Public Works Department": [
        ("large deep potholes on main road near {loc} causing accidents", "Roads / PWD", "Dangerous Pothole", "HIGH"),
        ("the main road has huge deep potholes near {loc}", "Roads / PWD", "Dangerous Pothole", "HIGH"),
        ("the road condition near {loc} is extremely bad and damaged", "Roads / PWD", "Road Repair Needed", "MEDIUM"),
        ("footpath is broken and paved tiles are missing near {loc}", "Roads / PWD", "Broken Footpath", "LOW"),
        ("road construction work near {loc} has been left incomplete for months", "Roads / PWD", "Incomplete Road Construction", "MEDIUM"),
        ("open manhole on main road near {loc} poses severe danger to pedestrians", "Roads / PWD", "Open Manhole Hazard", "CRITICAL"),
        ("road ki condition bahut kharab hai {loc} me", "Roads / PWD", "Road Repair Needed", "MEDIUM"),
        ("bhai {loc} ke paas rasta poora toota hua hai, pothole hain bohot", "Roads / PWD", "Dangerous Pothole", "HIGH"),
        ("open manhole hai road pe near {loc}", "Roads / PWD", "Open Manhole Hazard", "CRITICAL"),
        ("there is a huge pothole on the main road", "Roads / PWD", "Dangerous Pothole", "HIGH"),
        ("big pothole on main road causing accidents and damage to vehicles", "Roads / PWD", "Dangerous Pothole", "HIGH"),
        ("there are large potholes on the road making driving very dangerous", "Roads / PWD", "Dangerous Pothole", "HIGH"),
        ("pothole on road needs urgent repair before an accident happens", "Roads / PWD", "Dangerous Pothole", "HIGH"),
        ("road is completely broken with dangerous potholes everywhere", "Roads / PWD", "Dangerous Pothole", "HIGH"),
        ("sadak par bohot bade bade gaddhe hain, gaadi kharab ho rahi hai", "Roads / PWD", "Dangerous Pothole", "HIGH")
    ],
    "Electricity Department": [
        ("exposed live electrical wire hanging dangerously near school in {loc}", "Electricity", "Exposed Electrical Hazard", "CRITICAL"),
        ("live electrical wire fallen on road near {loc}", "Electricity", "Exposed Electrical Hazard", "CRITICAL"),
        ("power supply has been out in {loc} for more than {num} hours", "Electricity", "Power Outage", "HIGH"),
        ("frequent voltage fluctuations and power cuts in {loc} area", "Electricity", "Power Outage", "HIGH"),
        ("electricity transformer near {loc} is sparking violently and emitting smoke", "Electricity", "Transformer Sparking", "CRITICAL"),
        ("electric pole near {loc} is leaning dangerously and about to fall", "Electricity", "Damaged Electric Pole", "HIGH"),
        ("bijli 6 ghante se nahi hai {loc} me", "Electricity", "Power Outage", "HIGH"),
        ("transformer se spark nikal raha hai near {loc} market", "Electricity", "Transformer Sparking", "CRITICAL")
    ],
    "Sanitation Department": [
        ("public toilet near {loc} is extremely filthy and not cleaned", "Sanitation", "Public Toilet Cleaning", "MEDIUM"),
        ("sewage line overflowing near {loc} creating unsanitary conditions", "Sanitation", "Sewage Overflow", "HIGH"),
        ("severe foul odor coming from unmaintained public restroom near {loc}", "Sanitation", "Foul Smell / Unsanitary Area", "MEDIUM"),
        ("sewage ka paani raste pe beh raha hai near {loc}", "Sanitation", "Sewage Overflow", "HIGH"),
        ("sewage chamber overflowing on the walking pavement near {loc}", "Sanitation", "Sewage Overflow", "HIGH"),
        ("sewage manhole overflow causing smell and filth on pavement near {loc}", "Sanitation", "Sewage Overflow", "HIGH"),
        ("sewage chamber is overflowing and sewage spreading on street near {loc}", "Sanitation", "Sewage Overflow", "HIGH"),
        ("there is sewage overflowing from the chamber onto the walking path in {loc}", "Sanitation", "Sewage Overflow", "HIGH"),
        ("public toilet is closed and locked since {num} days near {loc}", "Sanitation", "Public Toilet Cleaning", "MEDIUM"),
        ("nuisance and stench from dirty public toilet near {loc} market", "Sanitation", "Foul Smell / Unsanitary Area", "MEDIUM")
    ],
    "Municipal Drainage Department": [
        ("drainage gutter overflow inundating street water in {loc}", "Drainage", "Drainage Overflow", "HIGH"),
        ("severe waterlogging in {loc} after light rain due to choked drains", "Drainage", "Waterlogging", "HIGH"),
        ("stormwater drain is completely clogged with silt near {loc}", "Drainage", "Clogged Gutter", "MEDIUM"),
        ("nali overflow kar rahi hai {loc} ke raste pe", "Drainage", "Drainage Overflow", "HIGH")
    ],
    "Electrical & Lighting Department": [
        ("streetlights turned off on main road near {loc} for {num} nights", "Street Lighting", "Streetlight Off", "MEDIUM"),
        ("streetlight pole broken and light fixture hanging near {loc}", "Street Lighting", "Broken Lamp Pole", "MEDIUM"),
        ("entire stretch of road near {loc} is pitch dark at night", "Street Lighting", "Dark Road Safety Concern", "HIGH"),
        ("street light 1 hafte se band hai {loc} me", "Street Lighting", "Streetlight Off", "MEDIUM")
    ],
    "Sanitation & Waste Department": [
        ("garbage has not been collected from {loc} for {num} days", "Waste Management", "Uncollected Garbage", "MEDIUM"),
        ("huge pile of uncollected trash dumped openly near {loc}", "Waste Management", "Open Waste Dumping", "MEDIUM"),
        ("community waste bin overflowing near {loc}", "Waste Management", "Garbage Dustbin Overflow", "MEDIUM"),
        ("kachra 4 din se nahi uthaya gaya hai {loc} se", "Waste Management", "Uncollected Garbage", "MEDIUM")
    ],
    "Public Health Department": [
        ("stagnant water pool near {loc} becoming mosquito breeding ground", "Public Health", "Mosquito Breeding Hazard", "HIGH"),
        ("fumigation and mosquito fogging required urgently in {loc}", "Public Health", "Vector Disease Control", "HIGH"),
        ("machhar bohot ho gaye hain stagnant water ke wajah se {loc} me", "Public Health", "Mosquito Breeding Hazard", "HIGH"),
        ("fogging karwao area me, dengue phail raha hai", "Public Health", "Vector Disease Control", "HIGH"),
        ("dengue cases badh rahe hain, please fogging karwao {loc} me", "Public Health", "Vector Disease Control", "HIGH"),
        ("dengue phail raha hai please fogging lagwao area me", "Public Health", "Vector Disease Control", "HIGH"),
        ("malaria aur dengue ke case badh rahe hain {loc} me, fogging karo", "Public Health", "Vector Disease Control", "HIGH"),
        ("bimari phail rahi hai please health department ko bhejo {loc} me", "Public Health", "Disease Outbreak", "HIGH"),
        ("mosquito se dengue ho raha hai area me fogging ki zaroorat hai", "Public Health", "Vector Disease Control", "HIGH"),
        ("plague and disease spreading in {loc} due to mosquitoes and stagnant water", "Public Health", "Disease Outbreak", "HIGH"),
        ("fever cases increasing in {loc} suspected dengue mosquito infestation", "Public Health", "Disease Outbreak", "HIGH"),
        ("urgent fogging required near {loc} due to mosquito menace and dengue threat", "Public Health", "Vector Disease Control", "HIGH")
    ],
    "Municipal Transport Department": [
        ("bus stop shelter shade damaged and rusted near {loc}", "Transport", "Bus Stop Damage", "LOW"),
        ("traffic signal lights not working at major intersection near {loc}", "Transport", "Traffic Signal Defect", "HIGH"),
        ("traffic light kharab hai near {loc} chowk", "Transport", "Traffic Signal Defect", "HIGH")
    ]
}

locations = [
    "Model Town", "Sector 17", "Civil Lines", "Railway Station Road", "Vasant Kunj", 
    "Karol Bagh", "Lajpat Nagar", "Connaught Place", "Dwarka Sector 10", "Rohini Sector 7"
]

num_days = ["2", "3", "4", "5", "7"]
days_list = ["Monday", "Tuesday", "yesterday", "last night", "this morning"]

records = []

for dept, items in template_specs.items():
    count_for_dept = 0
    # 200+ samples per department -> 1,800+ total
    while count_for_dept < 200:
        tmpl, cat, subcat, prio = random.choice(items)
        filler = random.choice(fillers)
        loc = random.choice(locations)
        num = random.choice(num_days)
        day = random.choice(days_list)

        body = tmpl.format(loc=loc, num=num, day=day)
        text = (filler + body).strip()

        if random.random() < 0.1:
            text = text.lower()

        records.append({
            "text": text,
            "department": dept,
            "category": cat,
            "subcategory": subcat,
            "priority": prio
        })
        count_for_dept += 1

random.shuffle(records)

data_dir = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(data_dir, exist_ok=True)
csv_path = os.path.join(data_dir, "grievance_dataset.csv")

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["text", "department", "category", "subcategory", "priority"])
    writer.writeheader()
    writer.writerows(records)

print(f"Generated {len(records)} correlated civic grievance dataset records in {csv_path}")
