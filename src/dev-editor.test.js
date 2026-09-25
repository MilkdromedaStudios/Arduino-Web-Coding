import {describe,expect,it} from 'vitest';
import {buildToolbox,equipmentBlockType,equipmentDefaults} from '../dev/src/blocks.js';
import {createArduinoGenerator} from '../dev/src/generator.js';

describe('/dev Arduino extension',()=>{
 it('contains only board-oriented categories and the important built-in equipment',()=>{
  const toolbox=buildToolbox(equipmentDefaults());
  expect(toolbox).toContain('name="Arduino extension"');
  expect(toolbox).toContain('arduino_touch');
  expect(toolbox).toContain('arduino_sound');
  expect(toolbox).toContain('arduino_ultrasonic');
  expect(toolbox).not.toMatch(/name="(Motion|Looks|Sprites|Backdrops)"/);
 });
 it('creates stable custom equipment block types',()=>expect(equipmentBlockType({id:'My Custom Sensor!'})).toBe('arduino_equipment_my_custom_sensor'));
 it('generates ultrasonic code with custom port aliases',()=>{
  const sensor={type:'arduino_ultrasonic',getFieldValue:name=>({TRIG:'TRIGGER_PIN',ECHO:'ECHO_PIN'})[name]};
  const print={type:'data_setvariableto',getFieldValue:()=>'',getField:()=>({getText:()=> 'distance'}),getInputTargetBlock:()=>sensor,getNextBlock:()=>null};
  const hat={type:'arduino_start',getInputTargetBlock:()=>print};
  const workspace={getAllVariables:()=>[{name:'distance'}],getTopBlocks:()=>[hat],getAllBlocks:()=>[hat,print,sensor]};
  expect(createArduinoGenerator().workspaceToCode(workspace)).toContain('readUltrasonic(TRIGGER_PIN, ECHO_PIN)');
 });
});
