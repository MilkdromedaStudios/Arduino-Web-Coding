const colours={events:'#ffbf00',pins:'#4c97ff',motion:'#4c97ff',control:'#ffab19',operators:'#59c059',data:'#ff8c1a',serial:'#0fbd8c',hardware:'#9966ff'};

export function registerArduinoBlocks(Blockly){
 const statement=(type,text,fields,colour)=>{Blockly.Blocks[type]={init(){const row=this.appendDummyInput().appendField(text);fields.forEach(([kind,name,value,options])=>row.appendField(kind==='number'?new Blockly.FieldNumber(value):kind==='menu'?new Blockly.FieldDropdown(options):new Blockly.FieldTextInput(value),name));this.setPreviousStatement(true);this.setNextStatement(true);this.setColour(colour);}}};
 const reporter=(type,text,fields,colour,check='Number')=>{Blockly.Blocks[type]={init(){const row=this.appendDummyInput().appendField(text);fields.forEach(([kind,name,value,options])=>row.appendField(kind==='number'?new Blockly.FieldNumber(value):kind==='menu'?new Blockly.FieldDropdown(options):new Blockly.FieldTextInput(value),name));this.setOutput(true,check);this.setColour(colour);}}};
 Blockly.Blocks.arduino_start={init(){this.appendDummyInput().appendField('when Arduino starts');this.appendStatementInput('SUBSTACK').appendField('forever');this.setColour(colours.events);this.setNextStatement(false);}};
 statement('arduino_pin_mode','set pin',[['number','PIN',13],['menu','MODE','OUTPUT',[['output','OUTPUT'],['input','INPUT'],['input pull-up','INPUT_PULLUP']]]],colours.pins);
 statement('arduino_digital_write','set digital pin',[['number','PIN',13],['menu','STATE','HIGH',[['high','HIGH'],['low','LOW']]]],colours.pins);
 reporter('arduino_digital_read','digital pin',[['number','PIN',2]],colours.pins,'Boolean');
 statement('arduino_analog_write','set PWM pin',[['number','PIN',9],['number','VALUE',128]],colours.pins);
 reporter('arduino_analog_read','analog pin',[['number','PIN',0]],colours.pins);
 statement('arduino_wait','wait ms',[['number','MS',1000]],colours.control);
 statement('arduino_serial_print','serial print',[['text','TEXT','Hello Arduino!']],colours.serial);
 reporter('arduino_millis','milliseconds since start',[],colours.serial);
 statement('arduino_servo','set servo pin',[['number','PIN',9],['number','ANGLE',90]],colours.hardware);
 statement('arduino_tone','play tone pin',[['number','PIN',8],['number','FREQUENCY',440],['number','DURATION',500]],colours.hardware);
 statement('arduino_no_tone','stop tone pin',[['number','PIN',8]],colours.hardware);
 statement('arduino_i2c_write','I²C address',[['number','ADDRESS',32],['number','VALUE',0]],colours.hardware);
 statement('arduino_custom','Arduino code',[['text','CODE','// extension code']],colours.hardware);
}

const block=x=>`<block type="${x}"/>`;
export const toolbox=`<xml style="display:none">
 <category name="Events" colour="${colours.events}" secondaryColour="${colours.events}">${block('arduino_start')}</category>
 <category name="Control" colour="${colours.control}" secondaryColour="${colours.control}">${block('control_repeat')}${block('control_forever')}${block('control_if')}${block('control_if_else')}${block('control_repeat_until')}${block('control_wait_until')}${block('control_stop')}${block('arduino_wait')}</category>
 <category name="Pins" colour="${colours.pins}" secondaryColour="${colours.pins}">${block('arduino_pin_mode')}${block('arduino_digital_write')}${block('arduino_digital_read')}${block('arduino_analog_write')}${block('arduino_analog_read')}</category>
 <category name="Operators" colour="${colours.operators}" secondaryColour="${colours.operators}">${block('operator_add')}${block('operator_subtract')}${block('operator_multiply')}${block('operator_divide')}${block('operator_mod')}${block('operator_random')}${block('operator_lt')}${block('operator_equals')}${block('operator_gt')}${block('operator_and')}${block('operator_or')}${block('operator_not')}${block('operator_mathop')}</category>
 <category name="Variables" colour="${colours.data}" secondaryColour="${colours.data}" custom="VARIABLE"></category>
 <category name="Serial" colour="${colours.serial}" secondaryColour="${colours.serial}">${block('arduino_serial_print')}${block('arduino_millis')}</category>
 <category name="Hardware" colour="${colours.hardware}" secondaryColour="${colours.hardware}">${block('arduino_servo')}${block('arduino_tone')}${block('arduino_no_tone')}${block('arduino_i2c_write')}${block('arduino_custom')}</category>
</xml>`;
