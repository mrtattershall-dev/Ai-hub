import sys
sys.path.append('.')
import r8_money

# Test that convertMoney is exported
try:
    convert_func = r8_money.convertMoney
    print("convertMoney function is exported successfully")
    
    # Test basic functionality
    result = convert_func(10000, "USD", "EUR", {"USD": 1, "EUR": 1.1})
    print(f"Conversion test: 10000 USD to EUR = {result} cents")
    
except AttributeError:
    print("convertMoney function is NOT exported")
except Exception as e:
    print(f"Error testing convertMoney: {e}")