const colours={events:'#ffbf00',pins:'#4c97ff',control:'#ffab19',operators:'#59c059',data:'#ff8c1a',serial:'#0fbd8c',hardware:'#9966ff',sensors:'#5cb1d6'};

const defaultEquipment=[
 {id:'servo',name:'Servo',kind:'output',template:'servo'},
 {id:'recorder',name:'Sound recorder',kind:'input',template:'analog'},
 {id:'touch',name:'Touch sensor',kind:'input',template:'digital'},
 {id:'amplifier',name:'Amplifier',kind:'output',template:'pwm'},
 {id:'ultrasonic',name:'Ultrasonic sensor',kind:'input',template:'ultrasonic'}
];
export const equipmentDefaults=()=>defaultEquipment.map(item=>({...item}));
const cleanId=value=>(value||'equipment').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||'equipment';
export const equipmentBlockType=item=>`arduino_equipment_${cleanId(item.id)}`;

export function registerArduinoBlocks(Blockly,equipment=defaultEquipment){
 const field=(kind,value,options)=>kind==='number'?new Blockly.FieldNumber(value):kind==='menu'?new Blockly.FieldDropdown(options):new Blockly.FieldTextInput(value);
 const statement=(type,text,fields,colour)=>{Blockly.Blocks[type]={init(){const row=this.appendDummyInput().appendField(text);fields.forEach(([kind,name,value,options])=>row.appendField(field(kind,value,options),name));this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour);}}};
 const reporter=(type,text,fields,colour,check='Number')=>{Blockly.Blocks[type]={init(){const row=this.appendDummyInput().appendField(text);fields.forEach(([kind,name,value,options])=>row.appendField(field(kind,value,options),name));this.setOutput(true,check);this.setColour(colour);}}};
 Blockly.Blocks.arduino_start={init(){this.appendDummyInput().appendField('when Arduino starts');this.appendStatementInput('SUBSTACK').appendField('forever');this.setColour(colours.events);this.setNextStatement(false);}};
 statement('arduino_pin_mode','set port',[['text','PIN','13'],['menu','MODE','OUTPUT',[['output','OUTPUT'],['input','INPUT'],['input pull-up','INPUT_PULLUP']]]],colours.pins);
 statement('arduino_digital_write','set digital port',[['text','PIN','13'],['menu','STATE','HIGH',[['high','HIGH'],['low','LOW']]]],colours.pins);
 reporter('arduino_digital_read','digital port',[['text','PIN','2']],colours.pins,'Boolean');
 statement('arduino_analog_write','set PWM port',[['text','PIN','9'],['number','VALUE',128]],colours.pins);
 reporter('arduino_analog_read','analog port',[['text','PIN','A0']],colours.pins);
 statement('arduino_wait','wait ms',[['number','MS',1000]],colours.control);
 statement('arduino_serial_print','serial print',[['text','TEXT','Hello Arduino!']],colours.serial);
 reporter('arduino_millis','milliseconds since start',[],colours.serial);
 statement('arduino_servo','set servo port',[['text','PIN','9'],['number','ANGLE',90]],colours.hardware);
 statement('arduino_tone','play tone port',[['text','PIN','8'],['number','FREQUENCY',440],['number','DURATION',500]],colours.hardware);
 statement('arduino_no_tone','stop tone port',[['text','PIN','8']],colours.hardware);
 reporter('arduino_touch','touch sensor port',[['text','PIN','2']],colours.sensors,'Boolean');
 reporter('arduino_sound','sound level port',[['text','PIN','A0']],colours.sensors);
 reporter('arduino_ultrasonic','distance cm trigger',[['text','TRIG','7'],['text','ECHO','6']],colours.sensors);
 statement('arduino_amplifier','set amplifier port',[['text','PIN','9'],['number','LEVEL',128]],colours.hardware);
 statement('arduino_i2c_write','I²C address',[['text','ADDRESS','0x20'],['number','VALUE',0]],colours.hardware);
 reporter('arduino_i2c_read','I²C read address',[['text','ADDRESS','0x20'],['number','COUNT',1]],colours.hardware);
 statement('arduino_custom','Arduino code',[['text','CODE','// custom equipment code']],colours.hardware);
 equipment.forEach(item=>{const type=equipmentBlockType(item);if(item.kind==='input')reporter(type,item.name,[['text','PORT',item.port||'A0']],colours.hardware);else statement(type,`set ${item.name}`,[['text','PORT',item.port||'9'],['number','VALUE',item.value??1]],colours.hardware)});
}

const block=x=>`<block type="${x}"/>`;
export function buildToolbox(equipment=defaultEquipment){return `<xml style="display:none">
 <category id="events" name="Events" colour="${colours.events}" secondaryColour="${colours.events}">${block('arduino_start')}</category>
 <category id="control" name="Control" colour="${colours.control}" secondaryColour="${colours.control}">${block('control_repeat')}${block('control_forever')}${block('control_if')}${block('control_if_else')}${block('control_repeat_until')}${block('control_wait_until')}${block('control_stop')}${block('arduino_wait')}</category>
 <category id="pins" name="Ports" colour="${colours.pins}" secondaryColour="${colours.pins}">${block('arduino_pin_mode')}${block('arduino_digital_write')}${block('arduino_digital_read')}${block('arduino_analog_write')}${block('arduino_analog_read')}</category>
 <category id="sensors" name="Sensors" colour="${colours.sensors}" secondaryColour="${colours.sensors}">${block('arduino_touch')}${block('arduino_sound')}${block('arduino_ultrasonic')}</category>
 <category id="operators" name="Operators" colour="${colours.operators}" secondaryColour="${colours.operators}">${block('operator_add')}${block('operator_subtract')}${block('operator_multiply')}${block('operator_divide')}${block('operator_mod')}${block('operator_random')}${block('operator_lt')}${block('operator_equals')}${block('operator_gt')}${block('operator_and')}${block('operator_or')}${block('operator_not')}${block('operator_mathop')}</category>
 <category id="variables" name="Variables" colour="${colours.data}" secondaryColour="${colours.data}" custom="VARIABLE"></category>
 <category id="serial" name="Serial" colour="${colours.serial}" secondaryColour="${colours.serial}">${block('arduino_serial_print')}${block('arduino_millis')}</category>
 <category id="hardware" name="Arduino extension" colour="${colours.hardware}" secondaryColour="${colours.hardware}">${block('arduino_servo')}${block('arduino_amplifier')}${block('arduino_tone')}${block('arduino_no_tone')}${block('arduino_i2c_write')}${block('arduino_i2c_read')}${equipment.map(item=>block(equipmentBlockType(item))).join('')}${block('arduino_custom')}</category>
</xml>`}
export const toolbox=buildToolbox();
