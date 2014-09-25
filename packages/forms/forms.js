Template.Form.helpers({
	template: function () {
		if (this._.template) {
			if (Template[this._.template]) return Template[this._.template];
			else {
				throw new Error('template not found');	
			}
		} else {
			return Template.DefaultForm || Template.__DefaultForm;
		}
	}
	, withForm: function () {
		var result = new ShadowObject(this.schema, this.item);

		// XXX extend result, or extend _ ?

		_.defaults(result._, this);

		return result;
	}
	, autosave: function () {
		if (this._.hasChanges()) {
			$(UI.currentView.firstNode().parentElement).trigger('autosave');
		}
	}
});

// actually all this is unnecessary...
// it would be pretty easy to just handle the submit as a normal event.

// Template.Form.events({
// 	'submit form': function (e, tmpl) {
// 		e.preventDefault();
// 		if (this._.hasChanges()) {
// 			$(e.currentTarget).trigger('dataSubmit');
// 		} else {
// 			alert('No changes!');
// 		}
// 	}
// });

Template.TextInput.helpers({
	template: function () {
		if (this.template) {
			if (Template[this.template]) return Template[this.template];
			else {
				throw new Error('template not found');	
			}
		} else {
			return Template.DefaultTextInput || Template.__DefaultTextInput;
		}
	}
});

Template.TextInput.events({
	'change input': function (e) {
		this.item[this.name] = e.currentTarget.value;
	}
});

UI.registerHelper('usefulField', function (field, item) {
	if (!item) {
		item = this;
	}
	if (typeof field == 'string') {
		field = {
			name: field
		};
	}
	return _.defaults({}, field, {
		item: item
		, value: item[field.name]
		, _: (item._ && item._.shadow[":" + field.name] || {})._ || {}
	});
});