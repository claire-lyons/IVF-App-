// Test script to verify stage detection logic
const fs = require('fs');

// Load the JSON data
const milestonesData = JSON.parse(fs.readFileSync('./public/milestones.json', 'utf8'));
const stagesData = JSON.parse(fs.readFileSync('./public/stages.json', 'utf8'));

console.log('=== Testing Stage Detection Logic ===\n');

// Test 1: Check if "Ovulation detected" milestone exists in milestones.json
console.log('1. Checking milestones.json for "Ovulation detected":');
const ovulationMilestone = milestonesData.find(m => 
  m.milestone_name === 'Ovulation detected' && m.cycle_template_id === 'FET'
);
console.log('Found milestone:', ovulationMilestone ? 'YES' : 'NO');
if (ovulationMilestone) {
  console.log('   Milestone ID:', ovulationMilestone.milestone_id);
  console.log('   Milestone Type:', ovulationMilestone.milestone_type);
}

// Test 2: Check if FET_LH_OV maps to correct stage in stages.json
console.log('\n2. Checking stages.json for FET_LH_OV mapping:');
const ovulationStage = stagesData.find(s => 
  s.milestone_id === 'FET_LH_OV' && s.cycle_template_id === 'FET'
);
console.log('Found stage mapping:', ovulationStage ? 'YES' : 'NO');
if (ovulationStage) {
  console.log('   Stage Name:', ovulationStage.stage_name);
  console.log('   Stage ID:', ovulationStage.stage_id);
  console.log('   Stage Details:', ovulationStage.stage_details.substring(0, 50) + '...');
}

// Test 3: Simulate the normalization logic
console.log('\n3. Testing normalization logic:');
const normalizeKey = (str) => str.toLowerCase().replace(/[-\s_]/g, '');
const milestoneType = 'ovulation-detected';
const normalizedType = normalizeKey(milestoneType);
console.log('   Original type:', milestoneType);
console.log('   Normalized type:', normalizedType);

// Test 4: Check if the mapping exists in the milestone mappings
console.log('\n4. Checking if mapping exists for normalized type:');
const milestoneMappings = {
  'lh': ['FET_LH_OV'],
  'ovulation': ['FET_LH_OV', 'IUI_TRIGGER'],
  'ovulationdetected': ['FET_LH_OV'], // This should be the fix
};

const mappingExists = milestoneMappings[normalizedType];
console.log('   Mapping exists:', mappingExists ? 'YES' : 'NO');
if (mappingExists) {
  console.log('   Maps to:', mappingExists);
}

// Test 5: Full flow simulation
console.log('\n5. Full flow simulation:');
console.log('   User creates milestone: "Ovulation detected" with type "ovulation-detected"');
console.log('   System normalizes type to:', normalizedType);
console.log('   System looks up mapping:', mappingExists ? mappingExists[0] : 'NOT FOUND');
if (mappingExists) {
  const finalStage = stagesData.find(s => s.milestone_id === mappingExists[0]);
  console.log('   Final stage result:', finalStage ? finalStage.stage_name : 'NOT FOUND');
}

console.log('\n=== Test Complete ===');